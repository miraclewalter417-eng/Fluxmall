import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
	getAuth,
	onAuthStateChanged,
	signOut,
	sendPasswordResetEmail,
	sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, collection, onSnapshot, query, orderBy, writeBatch, getDocs, deleteDoc, addDoc, where, serverTimestamp, limit, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
const firebaseConfig = {
	apiKey: "AIzaSyBw97sFAJ4_LvL5B4SIVmOX_M9F-CcfBio",
	authDomain: "flash-sales-8f768.firebaseapp.com",
	projectId: "flash-sales-8f768",
	storageBucket: "flash-sales-8f768.firebasestorage.app",
	messagingSenderId: "1048280668943",
	appId: "1:1048280668943:web:4e8cec214a1bd2e3e57c7a",
	measurementId: "G-V1J2MYF0H1"
	/* --- IGNORE ---
	apiKey: "AIzaSyA1nP6GuOZ201uX9IpgG5luRxO_6OPyBS0",
	authDomain: "timeego-35df7.firebaseapp.com",
	projectId: "timeego-35df7",
	storageBucket: "timeego-35df7.appspot.com",
	messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
	appId: "1:10386311177:web:0842e821cda6e7af9190d8"*/
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
export let currentUserData = null;
export let userDocRef = null;
export let users = null;
// --- INITIALIZATION & GLOBAL DATA ---
const SESSION_NAME = "userSession";
let globalConfig = { minWithdraw: 2000, withdrawFee: 100, userAppTheme: 'light' };
let unsubscribeUser = null; // To store the snapshot listener
let notifications = document.querySelector(".notifications");
// let closeBtn = null;

window.showToast = function(text, type = "success", icon, title) {
	// 1. Create a NEW element inside the function scope
	// 1. Vibrate the device immediately
	// Pattern: [vibrate for 100ms]
	if (window.navigator && window.navigator.vibrate) {
		window.navigator.vibrate(100);
	}
	let toastBox = document.createElement("div");
	toastBox.classList.add("toast", type);
	
	
	// 2. Set the inner HTML (Fixing the <i> tag syntax)
	toastBox.innerHTML = `
        <i class="${icon} toast-icon"></i>
        <div style="display: inline-block; margin-left: -3px;">
            <div class="title">${title}</div>
            <span>${text}</span>
        </div>
        <i class="ri-close-line cBtn" style="justify-self: flex-end; color: #ff4444;"></i>
    `;
	
	// 3. Append to the container
	notifications.appendChild(toastBox);
	
	// 4. Find the close button INSIDE this specific toast
	let closeBtn = toastBox.querySelector(".cBtn");
	
	closeBtn.onclick = function() {
		toastBox.remove(); // This removes the specific toast from the DOM
	};
	
	// 5. Optional: Auto-remove after 5 seconds so they don't stack forever
	setTimeout(() => {
		if (toastBox) toastBox.remove();
	}, 5000);
}

//document.addEventListener('DOMContentLoaded', () => {
onAuthStateChanged(auth, (user) => {
	//		showLoading(true);
	const cookie = getCookie(SESSION_NAME);
	// Valid session
	if (user && cookie && user.uid) {
		const userDocRef = doc(db, "flash-sales", "auth", "users", user.uid);
		startSecurityListeners(user.uid);
		loadTeamData(user.uid)
		generateReferralLink(user.uid)
		collectDailyEarnings(user.uid); // Automatic 24hr income collector
		loadMyInvestments(user.uid); // Load user's portfolio
		// 1. Initial loads that don't need real-time sync
		setTimeout(() => { showLoading(false) }, 2000)
		
		onSnapshot(userDocRef, (docSnap) => {
			//showLoading(false);
			
			if (docSnap.exists()) {
				currentUserData = docSnap.data();
				const users = currentUserData; // Keep your alias for compatibility
				
				// UI Updates
				if (users.lastCheckIn === new Date().toDateString()) {
					const btn = document.getElementById('checkinBtn');
					const msg = document.getElementById('checkinMsg');
					msg.innerText = "Already claimed! Check back tomorrow.";
					btn.innerHTML = `<i data-lucide="check"></i>`;
					btn.style.opacity = "0.5";
					btn.className = "check-box active";
					lucide.createIcons();
				}
				fetchUserHistory()
				
				// Handle User ID Display and Copy
				userId.forEach(idElement => {
					const shortId = user.uid.substring(0, 8);
					idElement.innerHTML = `${shortId}`;
					
					//	logActivity(user.uid, 'mtch', 5000, "yggg")
					
					
					
					// Use a fresh listener to avoid multiple clicks piling up
					idElement.onclick = () => {
						navigator.clipboard.writeText(user.uid).then(() => {
							showToast('ID Copied to clipboard! ♟️', 'success', "ri-clipboard-line", "Copied!");
						}).catch(err => {
							showToast('Failed to copy ID.', 'error', "ri-close-line", "Error");
						});
					}; // Use a fresh listener to avoid multiple clicks piling up
					
				});
				userEmail.forEach(idElement => {
					idElement.innerHTML = user.email;
				})
				userName.forEach(idElement => {
					idElement.innerHTML = users.username.substring(0, 10);
				})
				tBalance.forEach(idElement => {
					idElement.innerHTML = users.ib ?
						`${Number(users.ib).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` :
						'0.00';
				})
				// -------------------------------------------
				// 2. LISTEN TO HISTORY (Real-time list)
				// -------------------------------------------
				onSnapshot(query(collection(db, "flash-sales", "auth", 'deposits'),
					where("userId", "==", user.uid),
					orderBy("createdAt", "desc") // <--- Uncomment this ONLY after creating Index in Firebase Console
				), (snapshot) => {
					const list = document.getElementById('depositList');
					list.innerHTML = ""; // Clear list
					
					const deposits = [];
					snapshot.forEach(doc => deposits.push(doc.data()));
					
					// Sort manually to avoid index errors for now (Newest first)
					deposits.sort((a, b) => b.createdAt - a.createdAt);
					
					if (deposits.length === 0) {
						list.innerHTML = `   <div class="empty-state">
                    <div class="fox-logo-placeholder">🔮</div>
                    <p>Nothing here to see</p>
                </div>`;
						return;
					}
					
					deposits.forEach(data => {
						let badgeClass = '';
						if (data.status === 'pending') badgeClass = 'badge-pending';
						if (data.status === 'success') badgeClass = 'badge-success';
						if (data.status === 'declined') badgeClass = 'badge-declined';
						
						// Format Date
						let dateStr = "Just now";
						if (data.createdAt) dateStr = new Date(data.createdAt.seconds * 1000).toLocaleDateString();
						
						const itemHtml = `
                    <div class="history-item">
                        <div class="tx-details">
                            <span class="tx-amount">₦${data.amount.toLocaleString()}</span>
                            <span class="tx-ref">Ref: ${data.refCode}</span>
                            <span class="tx-date">${dateStr}</span>
                        </div>
                        <span class="badge ${badgeClass}">${data.status}</span>
                    </div>
                `;
						list.innerHTML += itemHtml;
					});
				});
				
				// -------------------------------------------
				// 3. DEPOSIT FUNCTION (Fixed)
				window.initiateDeposit = async function(amount) {
					if (!document.getElementById("attest").checked) {
						return showToast("For safety sake please Read before proceeding.", "warning", "ri-close-line", "Attestation");
					}
					// Convert to number for safety
					amount = Number(amount);
					
					if (!amount) return showToast("Enter valid amount (Minimum 3000)", "error", "ri-close-line", "Invalid Amount");
					const refCode = Math.floor(10000000 + Math.random() * 90000000).toString();
					confirmBtn.innerText = "Processing...";
					
					try {
						// A. Get Global Payment Settings
						const settingsRef = doc(db, "flash-sales", "auth", "settings", "payment");
						const settingsSnap = await getDoc(settingsRef);
						
						// Default fallbacks if settings don't exist yet
						const config = settingsSnap.exists() ? settingsSnap.data() : { mode: 'manual' };
						
						// --- MODE 1: KORAPAY AUTOMATIC ---
						if (config.mode === 'korapay' && config.korapay && config.korapay.publicKey) {
							payWithKorapay(amount, config.korapay.publicKey);
						}
						
						// --- MODE 2: MANUAL BANK TRANSFER ---
						else {
							// Use config bank details or fallback text
							const bankName = config.manual?.bankName || "Contact Admin";
							const accNum = config.manual?.accountNumber || "0000000000";
							const accName = config.manual?.accountName || "Admin";
							
							// --- STEP 3: Show Modal with FETCHED Details ---
							// Note the usage of ${bankInfo.bankName} etc. below
							const modalDiv = document.createElement('div');
							modalDiv.id = "paymentModal";
							modalDiv.className = "modal-overlay";
							modalDiv.innerHTML = `
    <br>
    <div class="modal-content">
        <h3 style="margin-top:0;color: var(--teal)">Complete Transfer</h3>
        <strong style="font-size: 1.3rem; color:#666">₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</strong>
        
        <div class="bank-details">
            <div class="detail-row">
                <p style="font-size: 0.9rem; color:#666">Transfer the exact amount to:</p>
            </div>

            <div class="detail-row">
                <span>Bank:</span>
                <strong>${bankName || 'Unknown Bank'}</strong>
            </div>

            <div class="detail-row">
                <span>Account:</span>
                <strong id="modalAcc">${accNum || 'Unknown Account'}</strong>
            </div>

            <div class="detail-row">
                <span>Name:</span>
                <strong>${accName || 'Unknown Name'}</strong>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 15px 0;">
            
            <div style="text-align: center; cursor: pointer;" onclick="copyText('modalRef')">
                <span style="font-size: 0.75rem; color: #666; text-transform: uppercase; font-weight: bold;">Use this Reference as Narration</span>
                <span class="ref-box" id="modalRef">${refCode}</span>
            </div>
            <p style="font-size: 0.8rem; color:#666;text-align: center;margin-top: 10px;">Note this account is only for this transaction</p>
      		 </div>

        			<button class="share-btn" onclick="submitManualDeposit(${amount})">I Have Sent the Money</button>
  					 </div>`;
							document.body.appendChild(modalDiv);
						}
						
					} catch (error) {
						console.error("Deposit Error:", error);
						showToast("An error occurred while processing your request.", "error", "ri-close-line", "Error");
					} finally {
						confirmBtn.innerText = "Recharge Again";
					}
				};
				// 2. KORAPAY LOGIC (Pop-up & Auto-Credit)
				let isProcessingDeposit = false;
				// 2. KORAPAY LOGIC
				window.payWithKorapay = (amount, key) => {
					if (!window.Korapay) {
						showToast("Payment error. Please refresh.", "error", "ri-close-line", "Error");
						return;
					}
					
					// Reset the lock when starting a new payment session
					isProcessingDeposit = false;
					
					const user = auth.currentUser;
					const ref = "DEP_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
					
					window.Korapay.initialize({
						key: key,
						reference: ref,
						amount: amount,
						currency: "NGN",
						customer: {
							name: user.username || "User",
							email: user.email
						},
						onClose: function() {
							isProcessingDeposit = false; // Reset lock if they close it
							showToast("Transaction cancelled.", "warning", "ri-close-line", "Cancelled");
						},
						onSuccess: function(data) {
							// Check if we are already saving this transaction
							if (isProcessingDeposit) {
								console.log("Prevented double-credit for ref:", data.reference);
								return;
							}
							
							// Set lock to true immediately
							isProcessingDeposit = true;
							
							// Payment Successful! Now save to DB
							finalizeDeposit(amount, 'Korapay', data.reference, 'success');
						}
					});
				};
				
				// 3. MANUAL SUBMIT LOGIC (Pending Approval)
				window.submitManualDeposit = (amount) => {
					closeModal()
					const ref = "MAN_" + Date.now(); // Generate a manual reference
					finalizeDeposit(amount, 'Bank Transfer', ref, 'pending');
					
				};
				
				// 4. FINAL SAVE FUNCTION
				async function finalizeDeposit(amount, method, refCode, status) {
					const user = auth.currentUser;
					if (!user) return;
					
					try {
						const batch = writeBatch(db);
						
						// A. Create Deposit Record
						const depositRef = doc(collection(db, "flash-sales", "auth", "deposits"));
						batch.set(depositRef, {
							userId: user.uid,
							//username: user.displayName || "User",
							amount: Number(amount),
							method: method,
							refCode: refCode,
							status: status,
							createdAt: serverTimestamp()
						});
						
						// B. If SUCCESS (Korapay), Credit Balance
						if (status === 'success') {
							const userRef = doc(db, "flash-sales", "auth", "users", user.uid);
							showToast(`🎉 Success! ₦${amount.toLocaleString()} added to wallet.`, "success", "ri-check-line", "Success");
							
							batch.update(userRef, {
								ib: increment(Number(amount))
							});
							
							// Ensure logActivity exists before calling
							if (typeof logActivity === "function") {
								logActivity(user.uid, 'Deposit', amount, "From Korapay");
							}
						}
						
						await batch.commit();
						
						// C. Show Success Message
						if (status === 'success') {
							showToast(`🎉 Success! ₦${amount.toLocaleString()} added to wallet.`, "success", "ri-check-line", "Success");
							window.location.reload();
						} else {
							showToast("Deposit Request Submitted!", "info", "ri-check-line", "Submitted");
							isProcessingDeposit = false; // Reset for manual if they want to try again
						}
						
					} catch (err) {
						isProcessingDeposit = false; // Reset lock so user can try again on error
						console.error("Deposit Save Error:", err);
						showToast("Error saving deposit: " + err.message, false, "ri-close-line", "Error");
					}
				}
				
				window.changePassword = async function() {
					//		showLoading(true);
					try {
						await sendPasswordResetEmail(auth, user.email);
						showToast(
							'A password reset link has been sent to your email. Please check your inbox or spam folder.',
							"info", "ri-check-line", "Success");
						//showPage('login-page');
					} catch (error) {
						let errorMessage = 'Failed to send password reset email. Please try again later.';
						if (error.code === 'auth/user-not-found') {
							errorMessage = "This Email isn't registered yet";
						} else if (error.code === 'auth/invalid-email') {
							errorMessage = 'The email address you entered is not valid.';
						} else {
							console.error("Password Reset Error:", error);
						}
						showToast(errorMessage, "error", "ri-close-line", "Error");
					} finally {
						//showLoading(false);
					}
				}
				
				// --- 2. Live Preview Calculation (Percentage Based) ---
				window.updateWithdrawPreview = () => {
					const amount = Number(document.getElementById('withdrawAmount').value);
					
					// Treat withdrawFee as a percentage (e.g., 5 = 5%)
					const percentage = globalConfig.withdrawFee || 0;
					const calculatedFee = (amount * percentage) / 100;
					
					const net = amount > calculatedFee ? amount - calculatedFee : 0;
					
					// Display the calculated Naira fee and Net amount
					document.getElementById('displayFee').innerText = `${percentage}%`;
					/*
											document.getElementById('displayFee').innerText = `₦${calculatedFee.toLocaleString()}%`;*/
					document.getElementById('netAmount').innerText = `₦${Math.floor(net).toLocaleString()}`;
				};
				// --- 3. The Core Withdrawal Logic (Percentage Based) ---
				window.handleWithdrawalSubmit = async () => {
					const amount = Number(document.getElementById('withdrawAmount').value);
					const btn = document.getElementById('withdrawBtn');
					
					// 1. Logic Validations
					if (!users.bankDetails || !users.bankDetails.accountNumber) {
						return showToast("Please bind your Bank Account in the Profile section first.", "warning", "ri-close-line", "Bank Details Required");
					}
					if (amount < globalConfig.minWithdraw) {
						return showToast(` Minimum withdrawal is ₦${globalConfig.minWithdraw.toLocaleString()}`, "warning", "ri-close-line", "Invalid Amount");
					}
					if (amount > users.ib) {
						return showToast("Insufficient balance.", "warning", "ri-close-line", "Insufficient Balance");
					}
					
					// 2. PERCENTAGE MATH
					const percentage = globalConfig.withdrawFee || 0;
					const feeAmount = (amount * percentage) / 100; // The actual Naira fee
					const netAmount = amount - feeAmount; // What the user gets
					
					const confirmMsg = `Withdrawal: ₦${amount.toLocaleString()}\n` +
						`Fee (${percentage}%): ₦${feeAmount.toLocaleString()}\n` +
						`You will receive: ₦${Math.floor(netAmount).toLocaleString()}\n\n` +
						`Confirm Withdrawal?`;
					
					if (confirm(confirmMsg)) {
						btn.disabled = true;
						btn.innerText = "Processing...";
						
						try {
							const userRef = doc(db, "flash-sales", "auth", "users", user.uid);
							
							// A. DEBIT THE USER IMMEDIATELY
							await updateDoc(userRef, {
								ib: increment(-amount)
							});
							logActivity(user.uid, 'Withdrawal', amount, "Withdrawal from site")
							
							// B. CREATE THE REQUEST FOR ADMIN
							await addDoc(collection(db, "flash-sales", "auth", "withdrawals"), {
								userId: user.uid,
								username: users.username || "Unknown User",
								amount: amount, // Total deducted from balance
								fee: feeAmount, // Calculated Naira fee
								feePercentage: percentage, // Recorded percentage for reference
								netAmount: Math.floor(netAmount), // Final payout amount
								status: "pending",
								bankDetails: users.bankDetails,
								remainingBalance: users.ib - amount,
								createdAt: serverTimestamp()
							});
							
							showToast("✅ Withdrawal request submitted successfully!", "info", "ri-check-line", "Success");
							document.getElementById('withdrawAmount').value = "";
							updateWithdrawPreview();
							
						} catch (err) {
							console.error("Transaction Error:", err);
							showToast("Something went wrong. Please check your connection.", "warning", "ri-close-line", "Error");
						} finally {
							btn.disabled = false;
							btn.innerText = "Confirm Withdrawal";
						}
					}
				};
				
				// -------------------------------------------
				// 2. LISTEN TO HISTORY (Real-time list)
				// -------------------------------------------
				onSnapshot(query(collection(db, "flash-sales", "auth", 'withdrawals'),
					where("userId", "==", user.uid),
					orderBy("createdAt", "desc") // <--- Uncomment this ONLY after creating Index in Firebase Console
				), (snapshot) => {
					const list = document.getElementById('withdrawList');
					list.innerHTML = ""; // Clear list
					
					const withdrawals = [];
					snapshot.forEach(doc => withdrawals.push(doc.data()));
					
					// Sort manually to avoid index errors for now (Newest first)
					withdrawals.sort((a, b) => b.createdAt - a.createdAt);
					
					if (withdrawals.length === 0) {
						list.innerHTML = `   <div class="empty-state">
                    <div class="fox-logo-placeholder">🔮</div>
                    <p>Nothing here to see</p>
                </div>`;
						return;
					}
					
					withdrawals.forEach(data => {
						let badgeClass = '';
						if (data.status === 'pending') badgeClass = 'badge-pending';
						if (data.status === 'success') badgeClass = 'badge-success';
						if (data.status === 'declined') badgeClass = 'badge-declined';
						
						// Format Date
						let dateStr = "Just now";
						if (data.createdAt) dateStr = new Date(data.createdAt.seconds * 1000).toLocaleDateString();
						
						const itemHtml = `
                    <div class="history-item">
                        <div class="tx-details">
                            <span class="tx-amount">₦${data.amount.toLocaleString()}</span>
                            <span class="tx-date">${dateStr}</span>
                        </div>
                        <span class="badge ${badgeClass}">${data.status}</span>
                    </div>
                `;
						list.innerHTML += itemHtml;
					});
				});
				
				
				
			} else {
				console.error("User document does not exist in Firestore.");
				//			showLoading(false);
			}
		}, (error) => {
			console.error("Snapshot error:", error);
			//				showLoading(false);
		});
		
	}
	else {
		// No user is signed in
		//showLoading(false);
		//	if (unsubscribeUser) unsubscribeUser();
		logoutUser()
		// Optional: 
		//	window.location.href = "/accounts/account.html";
		
	}
});


function startSecurityListeners(uid) {
	// A. Check for Ban Status (Personal Security)
	onSnapshot(doc(db, "flash-sales", "auth", "users", uid), (docSnap) => {
		if (docSnap.exists() && docSnap.data().status === 'Banned') {
			renderLockScreen("🚫 Account Banned", "Your account has been suspended for violating our terms of service. Contact support for appeals.");
		}
	});
	
	// B. Check for Maintenance & Global Theme (System Control)
	onSnapshot(doc(db, "flash-sales", "auth", "settings", "maintenance"), (snap) => {
		if (snap.exists() && snap.data().enabled) {
			renderLockScreen("🛠️ System Maintenance", "Our site is currently undergoing scheduled upgrades. We'll be back online shortly!");
		}
	});
	fetchAmounts()
	initBankSync();
	
	// --- 5. RENDER SHARES & PURCHASE LOGIC ---
	onSnapshot(query(collection(db, "flash-sales", "auth", "shares"), orderBy('price')), (snapshot) => {
		document.getElementById('shares-container').innerHTML = ""; //clear loader
		snapshot.forEach((doc) => {
			const data = doc.data();
			
			// Calculate total income if not stored in DB
			let totalIncome = data.dailyIncome * data.duration;
			
			const cardHTML = `
			                    <div class="action-card block" style="padding : 0; overflow: hidden">
                <div class="share-img-wrapper">
                    <img src="${data.img}" alt="${data.name}">
                    <div class="duration-badge">${data.duration} Days</div>
                </div>
                <div class="share-details">
                    <h3>${data.name}</h3>
                    <div class="stats-row">
                        <div class="stat-item" style="text-align: left">
                            <span>Price</span>
                            <b>₦${data.price.toLocaleString()}</b>
                        </div>
                        <div class="stat-item" style="text-align: right;">
                            <span>Daily Pay</span>
                            <b style="color: #10ac84;">₦${data.dailyIncome.toLocaleString()}</b>
                        </div>
                    </div>

                   <button class="buy-btn" onclick="buyShare('${doc.id}', ${data.price}, '${data.name}', ${data.dailyIncome}, ${data.duration})">Invest Now</button> 
            </div></div>


        `;
			document.getElementById('shares-container').innerHTML += cardHTML;
			
		});
	});
	
	// D. Listen for Notifications (Approvals/Declines)
	const q = query(collection(db, "flash-sales", "auth", "notifications"), where("userId", "==", uid), orderBy("createdAt", "desc"), limit(1));
	onSnapshot(q, (snapshot) => {
		snapshot.docChanges().forEach((change) => {
			if (change.type === "added") {
				const notif = change.doc.data();
				if (Date.now() - (notif.createdAt?.toMillis() || 0) < 10000) {
					showToast(`${notif.title}\n${notif.message}`, "info", "ri-information-line", "Notification");
				}
			}
		});
	});
}

// --- 1. REAL-TIME MASTER LOCK LISTENER ---
const initBankSync = () => {
	const userUid = auth.currentUser.uid;
	const saveBtn = document.getElementById('saveBtn');
	const inputs = ['bankName', 'accNumber', 'accName'];
	
	// Listen to your EXACT path: auth/settings/config
	onSnapshot(doc(db, "flash-sales", "auth", "settings", "config"), (snap) => {
		const isMasterLocked = snap.data()?.globalBankLock || false;
		
		if (isMasterLocked) {
			// 🔒 LOCK UI
			inputs.forEach(id => document.getElementById(id).disabled = true);
			saveBtn.disabled = true;
			document.getElementById("status-msg").innerText = "This feature is currently unavailable";
			saveBtn.innerText = "Contact support";
			saveBtn.style.display = 'none';
			saveBtn.classList.add('btn-disabled');
		} else {
			// 🔓 UNLOCK UI
			inputs.forEach(id => document.getElementById(id).disabled = false);
			saveBtn.disabled = false;
			saveBtn.innerText = "Save Details";
			saveBtn.classList.remove('btn-disabled');
		}
	});
	
	// --- 2. LOAD EXISTING USER DATA ---
	getDoc(doc(db, "flash-sales", "auth", "users", userUid)).then(userSnap => {
		if (userSnap.exists() && userSnap.data().bankDetails) {
			const bank = userSnap.data().bankDetails;
			document.getElementById('bankName').value = bank.bankName || "";
			document.getElementById('accNumber').value = bank.accountNumber || "";
			document.getElementById('accName').value = bank.accountName || "";
		}
	});
};

// --- 3. SMART SAVE FUNCTION ---
window.handleSave = async () => {
	const bName = document.getElementById('bankName').value.trim();
	const aNum = document.getElementById('accNumber').value.trim();
	const aName = document.getElementById('accName').value.trim();
	
	// 1. Basic Field Validation
	if (!bName || aNum.length < 10 || !aName) {
		return showToast("Please fill all fields correctly. Account number must be 10 digits.", "warning", "ri-close-line", "Invalid Input");
	}
	
	try {
		const userRef = doc(db, "flash-sales", "auth", "users", auth.currentUser.uid);
		
		// 2. Fetch User Data & Global Config simultaneously for speed
		const [userSnap, configSnap] = await Promise.all([
			getDoc(userRef),
			getDoc(doc(db, "flash-sales", "auth", "settings", "config"))
		]);
		
		const userData = userSnap.data() || {};
		const isMasterLocked = configSnap.data()?.globalBankLock || false;
		
		// 3. SMART LOCK LOGIC: 
		// Check if the user ALREADY has an account number saved
		const hasExistingBank = userData.bankDetails && userData.bankDetails.accountNumber;
		
		// If System is locked AND this is NOT the first time (it's an edit) -> BLOCK
		if (isMasterLocked && hasExistingBank) {
			return showToast("⛔ Access Denied: The system is currently locked for security. Please contact Admin to change existing details.", "warning", "ri-close-line", "Access Denied");
		}
		
		// 4. SAVE/UPDATE DATA (Using updateDoc, NOT deleteDoc!)
		await updateDoc(userRef, {
			bankDetails: {
				bankName: bName,
				accountNumber: aNum,
				accountName: aName,
				updatedAt: serverTimestamp()
			},
			// Optional: Automatically set their individual lock to false so you can control them later
			canEditBank: true
		});
		
		showToast("✅ Bank details saved successfully!", "info", "ri-check-line", "Success");
		
		// Optional: Reload to update UI locks if necessary
		if (typeof initBankSync === "function") initBankSync();
		
	} catch (err) {
		console.error("Save Error:", err);
		showToast("Error: " + err.message, "error", "ri-close-line", "Error");
	}
};


//Amt selection
const amountListDiv = document.getElementById('amountGrid');
const confirmInput = document.getElementById('customAmount');
const confirmBtn = document.getElementById('rechargeBtn');

const fetchAmounts = async () => {
	const colRef = collection(db, 'flash-sales', 'auth', 'depositAmt');
	
	try {
		const querySnapshot = await getDocs(colRef);
		let amountsArray = [];
		
		querySnapshot.forEach((doc) => {
			const data = doc.data();
			if (data.amount) amountsArray.push(Number(data.amount));
		});
		
		if (amountsArray.length > 0) {
			amountsArray.sort((a, b) => a - b);
			displayAmounts(amountsArray);
			
			// Auto-initiate with the minimum amount found
			//	initiateDeposit(amountsArray[0]);
		} else {
			// Updated fallback: Use an array so displayAmounts can handle the logic
			const defaultAmounts = [3000, 5000, 10000];
			displayAmounts(defaultAmounts);
			//	initiateDeposit(defaultAmounts[0]);
		}
		
	} catch (error) {
		console.error("Error fetching data:", error);
		amountListDiv.innerHTML = "<p style='color:red;'>Error loading amounts.</p>";
	}
};

const displayAmounts = (amounts) => {
	amountListDiv.innerHTML = '';
	
	amounts.forEach((amt, index) => {
		const card = document.createElement('div');
		card.className = 'amt-btn';
		// Check if it's the first item to make it active by default
		if (index === 0) {
			card.classList.add('active');
			confirmInput.value = amt.toFixed(2);
		}
		
		card.innerText = `₦${amt.toLocaleString()}`;
		
		card.onclick = () => {
			// Update input value
			confirmInput.value = amt.toFixed(2);
			
			// Remove active class from others and add to this one
			document.querySelectorAll('.amt-btn').forEach(c => c.classList.remove('active'));
			card.classList.add('active');
		};
		
		amountListDiv.appendChild(card);
	});
};


confirmBtn.onclick = () => {
	const selectedAmt = Number(confirmInput.value);
	if (selectedAmt > 0) {
		// Trigger the final deposit logic
		initiateDeposit(selectedAmt);
	}
};

// --- DAILY EARNINGS ENGINE (FIXED & SAFE) ---
async function collectDailyEarnings(uid) {
	const q = query(
		collection(db, "flash-sales", "auth", "purchased_shares"),
		where("userId", "==", uid),
		where("status", "==", "active")
	);
	
	const snap = await getDocs(q);
	if (snap.empty) return;
	
	let totalToCredit = 0;
	const updates = [];
	
	const now = new Date();
	
	for (const docSnap of snap.docs) {
		const share = docSnap.data();
		
		const lastClaim = share.lastClaimDate?.toDate() ||
			share.purchaseDate.toDate();
		
		const msPassed = now - lastClaim;
		const daysToClaim = Math.floor(msPassed / (1000 * 60 * 60 * 24));
		
		if (daysToClaim <= 0) continue;
		
		const earnings = daysToClaim * Number(share.dailyIncome);
		totalToCredit += earnings;
		
		const newClaimDate = new Date(
			lastClaim.getTime() + daysToClaim * 24 * 60 * 60 * 1000
		);
		
		updates.push(
			updateDoc(
				doc(db, "flash-sales", "auth", "purchased_shares", docSnap.id), { lastClaimDate: newClaimDate }
			)
		);
	}
	
	if (totalToCredit <= 0) return;
	
	// ✅ Wait for ALL share updates first
	await Promise.all(updates);
	
	// ✅ Atomic balance update (NO double credit ever)
	await updateDoc(
		doc(db, "flash-sales", "auth", "users", uid), { ib: increment(totalToCredit) }
	);
	logActivity(uid, "share", totalToCredit, "Profit")
	showToast(`💰 Daily Profit: ₦${totalToCredit.toLocaleString()} added to your balance!`, "info", "ri-check-line", "Profit Added");
}


window.buyShare = async (id, price, name, daily, dur) => {
	const userRef = doc(db, "flash-sales", "auth", "users", auth.currentUser.uid);
	const userSnap = await getDoc(userRef);
	const bal = userSnap.data().ib || 0;
	
	if (bal < price) return showToast("Insufficient Balance! try depositing", "warning", "ri-close-line", "Insufficient Balance");
	//window.location.href	="#deposit"
	if (confirm(`Buy ${name} for ₦${price.toLocaleString()}?`)) {
		await updateDoc(userRef, { ib: bal - price });
		//to be fixed
		logActivity(auth.currentUser.uid, 'Shares', name, "From shares")
		await addDoc(collection(db, "flash-sales", "auth", "purchased_shares"), {
			userId: auth.currentUser.uid,
			shareName: name,
			pricePaid: price,
			dailyIncome: daily,
			duration: dur,
			purchaseDate: serverTimestamp(),
			lastClaimDate: serverTimestamp(),
			status: "active"
		});
		showToast("Success! Investment Active.", "info", "ri-check-line", "Investment Active");
	}
};


// --- 6. MY INVESTMENTS PORTFOLIO (With Summing & Active Count) ---
function loadMyInvestments(uid) {
	const container = document.getElementById('myInvestmentsContainer');
	
	onSnapshot(query(collection(db, "flash-sales", "auth", "purchased_shares"), where("userId", "==", uid)), (snap) => {
		container.innerHTML = "";
		
		// 1. Initialize our counters
		let totalActiveSharesValue = 0;
		let totalActiveCount = 0; // This counts the number of shares
		
		if (snap.empty) {
			container.innerHTML = "<p style='text-align:center; color:gray;'>No active investments yet.</p>";
			console.log("📊 Summary: 0 active shares found.");
			return;
		}
		
		snap.forEach(async (docSnap) => {
			const d = docSnap.data();
			const docId = docSnap.id;
			
			// Calculate timing
			const purchaseDate = d.purchaseDate.toDate();
			const now = new Date();
			const daysPassed = Math.floor(Math.abs(now - purchaseDate) / (1000 * 60 * 60 * 24));
			const remaining = d.duration - daysPassed;
			
			// --- 🚀 AUTO-DELETE LOGIC ---
			if (remaining <= 0) {
				try {
					await deleteDoc(doc(db, "flash-sales", "auth", "purchased_shares", docId));
					return;
				} catch (err) {
					console.error("Error deleting:", err);
				}
			}
			
			// --- 2. UPDATE COUNTERS FOR ACTIVE SHARES ---
			totalActiveCount++; // Add 1 to the count for every active share
			totalActiveSharesValue += Number(d.amount || 0); // Sum the money value
			
			// --- RENDER ---
			const progressPercent = Math.min(100, (daysPassed / d.duration) * 100);
			
			container.innerHTML += `
			        <div class="order-card block">

            <div style=" display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;">
                <span class="product-name">${d.shareName.toUpperCase()}</span>
                <span class="status-badge"> <i class="ri-flashlight-fill" style="color:#f1c40f"></i>Auto Claim On</span>
            </div>

            <div class="info-row">
                <span class="label">Price:</span>
                <span class="value" style="color: var(--text-gray);">₦${d.pricePaid}</span>
            </div>
            <div class="info-row">
                <span class="label">Total Profit:</span>
                <span class="value">₦${d.dailyIncome * d.duration}</span>
            </div>
            <div class="info-row">
                <span class="label">Daily Profit:</span>
                <span class="value">₦${d.dailyIncome}</span>
            </div>
            <div class="info-row">
                <span class="label">Duration:</span>
                <span class="value">${d.duration}Days</span>
            </div>
            <div class="info-row">
                <span class="label">Date:</span>
                <span class="value">${d.purchaseDate.toDate().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
			 <div class="info-row" style="font-weight: 600;font-size: 1rem;color: var(--success);">
                <span class="label">Claimed:</span>
                <span style="color: var(--success);" class="value">₦${(daysPassed * d.dailyIncome).toLocaleString()}</span>
            </div>
			 <div class="progress-bar">
				<div class="progress-fill" style="width:${progressPercent}%"></div>
			 </div>
            <div class="info-row"> <span style="background: var(--success); color: white;" class="btn btn-secondary"><i class="ri-flashlight-fill" style="color:#f1c40f"></i>${d.status.charAt(0).toUpperCase() + d.status.slice(1)} Running</span>  
							      <span class="status-badge">${remaining} Days Left</span>
        </div> </div>`;
			/*
						
						
							<div class="investment-card">
								<h4>${d.shareName} <i class="ri-flashlight-fill" style="color:#f1c40f"></i></h4>
								<p>Earned so far: <span>₦${(daysPassed * d.dailyIncome).toLocaleString()}</span></p>
								<p>Status: <span>${remaining} Days Left</span></p>
								<div class="progress-bar">
									<div class="progress-fill" style="width:${progressPercent}%"></div>
								</div>
							</div>`;*/
		});
		
		
		// Optional: Update a UI element if you have one
		const countDisplay = document.getElementById('activeSharesCount');
		if (countDisplay) countDisplay.innerText = totalActiveCount;
	});
}


// --- 2. THE LOCK SCREEN FUNCTION ---
function renderLockScreen(title, message) {
	// This replaces the entire page content so no features are accessible
	document.body.innerHTML = `
        <div style="height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#0b1437; color:white; font-family:sans-serif; text-align:center; padding:30px;">
            <div style="background:rgba(255,255,255,0.05); padding:40px; border-radius:24px; border:1px solid rgba(255,255,255,0.1); box-shadow:0 20px 50px rgba(0,0,0,0.5);">
                <h1 style="font-size:2rem; margin-bottom:15px;">${title}</h1>
                <p style="color:#94a3b8; line-height:1.6; max-width:400px; margin-bottom:30px;">${message}</p>
                <button onclick="location.reload()" style="padding:12px 24px; background:#4318ff; color:white; border:none; border-radius:12px; font-weight:700; cursor:pointer;">Retry Connection</button>
            </div>
            <div onclick="logoutUser()">Home</div>
        </div>
    `;
	// Stop any further background execution
	window.stop();
}

window.closeWelcomeModal = () => {
	document.getElementById('welcomeModal').style.display = 'none';
	// Remember that it was shown so it doesn't pop up on every page refresh
	showLoading(false);
	sessionStorage.setItem('welcomeShown', 'true');
};

// Fetch Admin Rules
onSnapshot(doc(db, "flash-sales", "auth", "settings", "config"), (snap) => {
	if (snap.exists()) {
		globalConfig = snap.data();
		document.getElementById('minLimitTxt').innerText = `Minimum withdrawal: ₦${globalConfig.minWithdraw.toLocaleString()}`;
		document.getElementById('withdrawAmount').placeholder = `Min: ₦${globalConfig.minWithdraw}`;
		document.getElementById('displayFee').innerText = `${globalConfig.withdrawFee}%`;
		if (globalConfig.userAppTheme) document.documentElement.setAttribute('data-theme', globalConfig.userAppTheme);
		
		if (globalConfig.referralPercents) {
			document.getElementById('ref1').innerText = globalConfig.referralPercents[0] || 0;
			document.getElementById('ref2').innerText = globalConfig.referralPercents[1] || 0;
			document.getElementById('ref3').innerText = globalConfig.referralPercents[2] || 0;
		}
		
		// --- LOAD MODAL DATA FROM FIREBASE ---
		const modal = document.getElementById('welcomeModal');
		document.getElementById('siteAbout').innerHTML = globalConfig.siteAbout || "Welcome to our premium platform. Founded on trust and speed.";
		
		// 1. Check if user already saw the modal in this session (optional)
		if (sessionStorage.getItem('welcomeShown')) return;
		// Set About Text from Admin Config
		// Set Social Links from Admin Config
		document.querySelectorAll('.tgLink').forEach(el => {
			el.href = globalConfig.telegramLink || "#";
		});
		document.querySelectorAll('.waLink').forEach(el => {
			el.href = globalConfig.whatsappLink || "#";
		});
		// Show the modal
		modal.style.display = 'flex';
		
	}
});

// Helper function to copy code
window.copyText = function(elementId) {
	const element = document.getElementById(elementId);
	if (!element) return;
	
	// Use innerText for <span> elements
	const textToCopy = element.innerText;
	
	navigator.clipboard.writeText(textToCopy).then(() => {
		// Assuming showAlert is a function you've defined elsewhere
		if (typeof showAlert === "function") {
			showToast(textToCopy + ' Copied Successfully', "info", "ri-check-line", "Copied");
		} else {
			showToast('Copied: ' + textToCopy, "info", "ri-check-line", "Copied");
		}
	}).catch(err => {
		console.error('Failed to copy text: ', err);
	});
};
// Helper function to close modal (if you don't have it already)
window.closeModal = function() {
	const modal = document.getElementById('paymentModal');
	if (modal) modal.remove();
	
	// Explicitly find the button by ID and reset it
	const rechargeBtn = document.getElementById('confirmBtn'); // Ensure your button has this ID in HTML
	if (rechargeBtn) {
		rechargeBtn.innerText = "Recharge Again";
	}
};

const syncBranding = async () => {
	try {
		const configSnap = await getDoc(doc(db, "flash-sales", "auth", "settings", "config"));
		
		if (configSnap.exists()) {
			const data = configSnap.data();
			// 1. DYNAMIC COLOR SYNC 🎨
			
			// Update all Site Name instances (Header, Footer, Titles)
			if (data) {
				document.querySelectorAll('.site-name').forEach(el => {
					el.innerText = data.siteName;
				});
				document.title = data.siteName; // Updates browser tab title
				// Update Logo
				// 2. Update Main Logo
				const logoImg = document.querySelectorAll('.logo-img');
				logoImg.forEach(img => {
					img.src = data.siteLogo;
				});
				if (!data.siteLogo) {
					logoImg.forEach(img => {
						img.style.display = 'none';
					});
				}
				
				let link = document.querySelector("link[rel~='icon']");
				if (!link) {
					link = document.createElement('link');
					link.rel = 'icon';
					document.getElementsByTagName('head')[0].appendChild(link);
				}
				link.href = data.siteLogo;
			}
		}
	} catch (err) {
		console.log("Branding sync failed:", err);
	}
};

// Call this when the page loads
syncBranding();



async function loadTeamData(uid) {
	try {
		const usersCol = collection(db, "flash-sales", "auth", "users");
		
		// 1. Get Level 1
		const q1 = query(usersCol, where("referrerId", "==", uid));
		const snap1 = await getDocs(q1);
		const l1Ids = snap1.docs.map(d => d.id);
		document.getElementById('countL1').innerText = l1Ids.length;
		
		// 2. Get Level 2 (Referrals of L1)
		let l2Count = 0;
		let l2Ids = [];
		if (l1Ids.length > 0) {
			const q2 = query(usersCol, where("referrerId", "in", l1Ids));
			const snap2 = await getDocs(q2);
			l2Ids = snap2.docs.map(d => d.id);
			l2Count = l2Ids.length;
		}
		document.getElementById('countL2').innerText = l2Count;
		
		// 3. Get Level 3 (Referrals of L2)
		let l3Count = 0;
		if (l2Ids.length > 0) {
			// Firestore 'in' query supports max 10 IDs. 
			// For large teams, you'd loop or use a different structure.
			const q3 = query(usersCol, where("referrerId", "in", l2Ids.slice(0, 10)));
			const snap3 = await getDocs(q3);
			l3Count = snap3.size;
		}
		document.getElementById('countL3').innerText = l3Count;
		
		// 4. Update Totals
		document.getElementById('totalTeam').innerText = l1Ids.length + l2Count + l3Count;
		
		// Fetch your balance for the earnings display
		const me = await getDoc(doc(db, "flash-sales", "auth", "users", uid));
		document.getElementById('totalEarnings').innerText = `₦${(me.data().refPoints || 0).toLocaleString()}`;
		
	} catch (err) {
		console.error("Team loading error:", err);
	}
}


const generateReferralLink = (uid) => {
	// Automatically detects if you are on localhost or your live domain
	const domain = window.location.origin;
	const fullLink = `${domain}/accounts/account.html?tab=signup-page&ref=${uid}`;
	document.getElementById('referralURL').value = fullLink;
};

// --- COPY TO CLIPBOARD ---
window.copyReferralLink = () => {
	const copyText = document.getElementById("referralURL");
	copyText.select();
	copyText.setSelectionRange(0, 99999); // For mobile devices
	
	navigator.clipboard.writeText(copyText.value);
	
	const btn = document.getElementById('copyBtn');
	btn.innerHTML = '<i class="ri-check-line"></i>';
	setTimeout(() => { btn.innerHTML = '<i class="ri-file-copy-line"></i>'; }, 2000);
};

// --- WHATSAPP SHARING ---
window.shareOnWhatsApp = () => {
	const link = document.getElementById('referralURL').value;
	const siteName = document.title;
	const message = `Hey! Check out ${siteName}, I'm making money daily here. Register with my link to get started: ${link}`;
	
	window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
};

window.handleDailyCheckIn = async () => {
	const btn = document.getElementById('checkinBtn');
	const msg = document.getElementById('checkinMsg');
	const uid = auth.currentUser.uid;
	
	// 1. Get current date as a simple string (e.g., "Mon Feb 02 2026")
	const today = new Date().toDateString();
	
	try {
		btn.disabled = true;
		btn.innerText = "Checking...";
		
		const userRef = doc(db, "flash-sales", "auth", "users", uid);
		const userSnap = await getDoc(userRef);
		const userData = userSnap.data();
		
		// 2. Compare dates
		if (!userData.hasDeposited) {
			showToast("⚠️ Please make your first deposit to unlock daily check-in rewards!", "warning", "ri-close-line", "No Deposit");
			btn.disabled = false; // RE-ENABLE so they can try later
			btn.innerText = "Claim";
			return;
		}
		if (userData.lastCheckIn === today) {
			msg.innerText = "Already claimed! Check back tomorrow.";
			btn.innerHTML = `<i data-lucide="check"></i>`;
			btn.style.opacity = "0.5";
			btn.className = "check-box active";
			lucide.createIcons();
			
			return;
		}
		let configSnap = await getDoc(doc(db, "flash-sales", "auth", "settings", "config"));
		let reward = configSnap.data().dailyCheckInAmount || 50;
		await updateDoc(userRef, {
			ib: increment(reward),
			lastCheckIn: today
		});
		logActivity(uid, 'Check-in', reward, "Daily checkin bonus")
		showToast("🎉 Success! " + '' + reward + ' ' + "points added to your account.", "info", "ri-check-line", "Check-in Reward");
		msg.innerText = "Success! Come back tomorrow for more.";
		btn.innerText = "Claimed";
		
		// Refresh the balance display if you have one
		//		if (typeof loadUserData === 'function') loadUserData(uid);
		
	} catch (err) {
		console.error("Check-in Error:", err);
		showToast("Check-in failed. Please try again later.", "error", "ri-close-line", "Error");
		btn.disabled = false;
		btn.innerText = "Claim Points";
	}
};


window.logActivity = async (uid, type, amount, description) => {
	try {
		await addDoc(collection(db, "flash-sales", "auth", "activity"), {
			userId: uid,
			type: type, // e.g., "Check-in", "Deposit", "Referral", "Spin"
			amount: amount,
			desc: description,
			timestamp: serverTimestamp()
		});
	} catch (e) {
		console.error("Logging failed", e);
	}
};

window.fetchUserHistory = async () => {
	const list = document.getElementById('historyList');
	const uid = auth.currentUser.uid;
	list.innerHTML = "Loading history...";
	
	const q = query(
		collection(db, "flash-sales", "auth", "activity"),
		where("userId", "==", uid),
		orderBy("timestamp", "desc"),
		limit(12)
	);
	
	const snap = await getDocs(q);
	list.innerHTML = "";
	
	snap.forEach(doc => {
		const item = doc.data();
		const date = item.timestamp?.toDate().toLocaleDateString() || "Just now";
		
		const div = document.createElement('div');
		div.className = "history-item";
		div.innerHTML = `
            <div class="tx-details">
                <h5>${item.type}: ${item.desc}</h5>
                <span class="tx-date">${date}</span>
            </div>
            <div class="badge">| ${item.amount}</div>
        `;
		list.appendChild(div);
	});
};


function getCookie(name) {
	
	const cookies = document.cookie.split(";");
	
	for (let cookie of cookies) {
		
		const c = cookie.trim();
		
		if (c.startsWith(name + "=")) {
			return c.substring(name.length + 1);
		}
	}
	
	return null;
}


function deleteCookie(name) {
	
	document.cookie =
		name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}

// ===========================
// LOGOUT
// ===========================
window.logoutUser = async function() {
	
	await signOut(auth);
	deleteCookie(SESSION_NAME);
	
	//	showTab("login");
	window.location.href = "/accounts/account.html"
};



// LISTEN FOR REAL-TIME THEME CHANGES
const configRef = doc(db, "flash-sales", "auth", "settings", "config");

onSnapshot(configRef, (docSnap) => {
	if (docSnap.exists() && docSnap.data().theme) {
		applyTheme(docSnap.data().theme);
	}
});

function applyTheme(theme) {
	const root = document.documentElement;
	
	// 1. Set Colors
	root.style.setProperty('--primary', theme.primary);
	root.style.setProperty('--teal', theme.secondary);
	
	// 2. Set Mode (Backgrounds/Text)
	if (theme.mode === 'dark') {
		// Dark Mode Palette
		//root.style.setProperty('--bg-color', '#0b1437'); // Deep Navy
		root.style.setProperty('--card-bg', '#111c44'); // Lighter Navy
		root.style.setProperty('--text-main', '#ffffff');
		root.style.setProperty('--text-muted', '#a3adc2'); // Soft Grey
		root.style.setProperty('--input-bg', '#1b254b');
		root.style.setProperty('--border', 'rgba(255,255,255,0.1)');
	} else {
		// Light Mode Palette
		root.style.setProperty('--bg-color', '#f4f7fe'); // Light Grey-Blue
		root.style.setProperty('--card-bg', '#ffffff'); // Pure White
		root.style.setProperty('--text-main', '#2b3674'); // Dark Blue Text
		root.style.setProperty('--text-muted', '#a3adc2'); // Soft Grey
		root.style.setProperty('--input-bg', '#f4f7fe');
		root.style.setProperty('--border', '#e0e5f2');
	}
	
	console.log("🎨 Theme updated:", theme.mode);
}

const ticker = document.getElementById('ticker-wrapper');
const tickerText = document.querySelectorAll('.ticker-text');
onSnapshot(doc(db, "flash-sales", "auth", "settings", "config"), (docSnap) => {
	if (docSnap.exists()) {
		const data = docSnap.data();
		
		// 1. Handle Theme (Existing code)
		if (data.theme) applyTheme(data.theme);
		
		// 2. Handle Announcement
		if (!ticker) return; // safety check
		
		if (data.announcement?.active) {
			
			ticker.style.display = "flex";
			tickerText.forEach(textTick => {
				textTick.textContent = data.announcement.text || "No Announcement";
			});
		} else {
			// Optional: Reset speed to 15s when inactive so it's ready for next time
			tickerText.forEach(textTick => {
				textTick.style.animationDuration = "15s";
			});
			
			ticker.style.display = "none";
		}
		
	}
});