import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
	getAuth,
	signOut,
	sendPasswordResetEmail,
	signInWithEmailAndPassword,
	createUserWithEmailAndPassword,
	sendEmailVerification,
	setPersistence,
	browserLocalPersistence,
	browserSessionPersistence,
	onAuthStateChanged,
	EmailAuthProvider,
	reauthenticateWithCredential, // Add these to your imports at the top
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
	getFirestore,
	collection,
	query,
	onSnapshot,
	orderBy,
	doc,
	updateDoc,
	getDoc,
	getDocs,
	increment,
	deleteDoc,
	setDoc,
	addDoc,
	where,
	serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. YOUR FIREBASE CONFIG
const firebaseConfig = {
	apiKey: "AIzaSyBw97sFAJ4_LvL5B4SIVmOX_M9F-CcfBio",
	authDomain: "flash-sales-8f768.firebaseapp.com",
	projectId: "flash-sales-8f768",
	storageBucket: "flash-sales-8f768.firebasestorage.app",
	messagingSenderId: "1048280668943",
	appId: "1:1048280668943:web:4e8cec214a1bd2e3e57c7a",
	measurementId: "G-V1J2MYF0H1"
	/*
	apiKey: "AIzaSyA1nP6GuOZ201uX9IpgG5luRxO_6OPyBS0",
	authDomain: "timeego-35df7.firebaseapp.com",
	projectId: "timeego-35df7",
	storageBucket: "timeego-35df7.appspot.com",
	messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
	appId: "1:10386311177:web:0842e821cda6e7af9190d8"*/
};
const IMGBB_API_KEY = "0251ff89aa26f5ade333ed4e51cdc2e1"; // Get this from api.imgbb.com
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// --- 1. PRIMARY APP (Used for Admin Login) ---

// --- 2. SECONDARY APP (Used ONLY for creating users) ---
// We give it a unique name like "Secondary" so it doesn't conflict
const secondaryApp = initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = getAuth(secondaryApp);
let allData = [];
// --- NOTIFICATION LOGIC ---
let flashInterval = null;
let originalTitle = document.title;
let isFirstLoadDeposits = true;
let isFirstLoadWithdrawals = true;
const savedTheme = localStorage.getItem('exempe-theme') || 'light';
const SESSION_HOURS = 8;
const SESSION_NAME = "adminSession";

// CONFIG
// ========================================
const BIOMETRIC_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
let lastBiometricVerification = 0;

// ========================================
// Convert Base64 → Uint8Array
// ========================================
function base64ToUint8Array(base64) {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}


function randomBuffer(len = 32) {
	return crypto.getRandomValues(new Uint8Array(len));
}

async function verifyAdminBiometric() {
	try {
		const now = Date.now();
		// ========================================
		// Check cache first
		// ========================================
		if (now - lastBiometricVerification < BIOMETRIC_CACHE_DURATION) {
			console.log("Biometric cached — skipping scan");
			return true;
		}


		const user = auth.currentUser;
		if (!user) {
			alert("Admin not logged in");
			return false;
		}

		/*
				const adminRef =
					doc(db, "flash-sales", "auth", "admins", user.uid);
				const adminSnap =
					await getDoc(adminRef);
				if (!adminSnap.exists()) {
					alert("Admin record not found");
					return false;
				}
		
				const credentialId =
					adminSnap.data().credentialId;
				if (!credentialId) {
					alert("No fingerprint registered");
					return false;
				}
		
				// ========================================
				// Trigger biometric scan
				// ========================================
				await navigator.credentials.get({
					publicKey: {
						challenge: randomBuffer(),
						allowCredentials: [
							{
								id: base64ToUint8Array(credentialId),
								type: "public-key"
							}],
						userVerification: "required",
						timeout: 60000
					}
				});*/
		// ========================================
		// Save verification time (CACHE)
		// ========================================
		lastBiometricVerification = Date.now();

		console.log("Biometric verified");
		return true;

	}
	catch (err) {
		console.log("Biometric failed:", err);
		alert("Failed! Maybe your device doesn't support this feature yet...")
		return false;
	}
}

onAuthStateChanged(auth, async (user) => {
	const cookie = getCookie(SESSION_NAME);
	// Valid session
	if (user && cookie) {
		showTab("analytics-tab");
		// --- RUN ON STARTUP ---
		// Call this at the bottom of your script or inside your auth state listener
		loadThemeSettings();
		window.startFlash = (msg) => {
			if (flashInterval) return;
			flashInterval = setInterval(() => {
				document.title = document.title === originalTitle ? `🔔 ${msg}` : originalTitle;
			}, 800);
		};

		window.stopFlash = () => {
			clearInterval(flashInterval);
			flashInterval = null;
			document.title = originalTitle;
		};

		// --- CHARTS ---
		let pieChart, barChart;

		function setupCharts() {
			const pCtx = document.getElementById('pieChart').getContext('2d');
			pieChart = new Chart(pCtx, {
				type: 'doughnut',
				data: { labels: ['Success', 'Pending', 'Declined'], datasets: [{ data: [0, 0, 0], backgroundColor: ['#05cd99', '#f6ad55', '#ee5d50'] }] },
				options: { plugins: { legend: { position: 'bottom' } } }
			});

			const bCtx = document.getElementById('barChart').getContext('2d');
			barChart = new Chart(bCtx, {
				type: 'bar',
				data: {
					labels: ['Deposits', 'Withdrawals'],
					datasets: [{
						label: '₦ Value',
						data: [0, 0],
						backgroundColor: ['#4318ff', '#ee5d50'],
						borderRadius: 10
					}]
				},
				options: {
					responsive: true,
					// 🚀 THIS IS THE KEY LINE:
					maintainAspectRatio: false,
					plugins: {
						legend: { display: false, position: 'bottom' }
					},
					scales: {
						y: {
							beginAtZero: true,
							ticks: {
								// Optional: make font bigger since chart is taller
								font: { size: 8 }
							}
						}
					}
				}
			});
		}
		setupCharts();

		// 3. REAL-TIME DATA SYNC
		onSnapshot(query(collection(db, "flash-sales", "auth", "deposits"), orderBy("createdAt", "desc")), (snap) => {
			allData = [];
			let stats = { successV: 0, pendingV: 0, sCount: 0, pCount: 0, dCount: 0 };
			let userMap = {};

			if (!isFirstLoadDeposits) {
				snap.docChanges().forEach(change => {
					if (change.type === "added") startFlash("NEW DEPOSIT!");
				});
			}

			snap.forEach(docSnap => {
				const d = docSnap.data();
				const item = { id: docSnap.id, ...d };
				allData.push(item);

				// Group by User
				if (!userMap[d.userId]) userMap[d.userId] = { id: d.userId, count: 0, total: 0 };
				userMap[d.userId].count++;

				if (d.status === 'success') {
					stats.successV += Number(d.amount);
					stats.sCount++;
					userMap[d.userId].total += Number(d.amount);
				} else if (d.status === 'pending') {
					stats.pendingV += Number(d.amount);
					stats.pCount++;
				} else {
					stats.dCount++;
				}
			});

			// Update Analytics UI
			document.getElementById('statTotal').innerText = `₦${stats.successV.toLocaleString()}`;
			document.getElementById('statPending').innerText = `₦${stats.pendingV.toLocaleString()}`;
			document.getElementById('statUsers').innerText = Object.keys(userMap).length;

			document.getElementById('analyticsTableBody').innerHTML = `
                <tr><td>Successful</td><td></td><td>${stats.sCount}</td><td>₦${stats.successV.toLocaleString()}</td></tr>
                <tr><td>Pending</td><td></td><td>${stats.pCount}</td><td>₦${stats.pendingV.toLocaleString()}</td></tr>
                <tr><td>Declined</td><td></td><td>${stats.dCount}</td><td>--</td></tr>
            `;

			pieChart.data.datasets[0].data = [stats.sCount, stats.pCount, stats.dCount];
			pieChart.update();
			barChart.data.datasets[0].data[0] = stats.successV;
			barChart.update();
			isFirstLoadDeposits = false;
			renderDeposits(allData);
			renderUsers();
		});
		// --- 3-LEVEL COMMISSION LOGIC ---
		window.handleReferralCommission = async function (depositorUid, depositAmount, tid) {
			try {
				// 1. FETCH DYNAMIC CONFIG FROM FIREBASE
				const configRef = doc(db, "flash-sales", "auth", "settings", "config");
				const configSnap = await getDoc(configRef);

				// Fallback to your original 15, 8, 4 if the config is missing
				let rates = [15, 4, 2];
				if (configSnap.exists() && configSnap.data().referralPercents) {
					rates = configSnap.data().referralPercents;
				}

				// Convert whole numbers (e.g., 15) to decimals (0.15)
				const L1_RATE = (rates[0] || 0) / 100;
				const L2_RATE = (rates[1] || 0) / 100;
				const L3_RATE = (rates[2] || 0) / 100;

				const userRef = doc(db, "flash-sales", "auth", "users", depositorUid);
				const userSnap = await getDoc(userRef);
				const userData = userSnap.data();
				const amount = Number(depositAmount);

				// Update the transaction status to success immediately
				await updateStatus(tid, 'success', amount, depositorUid);

				// 2. SECURITY CHECK: Only pay referral if this is their first deposit
				if (userData.hasDeposited === true) {
					console.log("Returning user deposit. Referral commission skipped.");
					return;
				}
				if (!(await verifyAdminBiometric())) return;
				await updateDoc(userRef, { hasDeposited: true });

				// 3. START THE 3-LEVEL PAYOUT
				if (userData.referrerId) {
					const l1Id = userData.referrerId;
					// Level 1 payout
					await payReferrer(l1Id, amount * L1_RATE, "Level 1");

					// Fetch Level 2
					const l1Snap = await getDoc(doc(db, "flash-sales", "auth", "users", l1Id));
					const l2Id = l1Snap.data()?.referrerId;

					if (l2Id) {
						// Level 2 payout
						await payReferrer(l2Id, amount * L2_RATE, "Level 2");

						// Fetch Level 3
						const l2Snap = await getDoc(doc(db, "flash-sales", "auth", "users", l2Id));
						const l3Id = l2Snap.data()?.referrerId;

						if (l3Id) {
							// Level 3 payout
							await payReferrer(l3Id, amount * L3_RATE, "Level 3");
						}
					}
				}

				// 4. Mark user as "Already Deposited" so their next deposit doesn't pay out again

				console.log("✅ Referral logic completed successfully.");

			} catch (err) {
				console.error("Referral System Error:", err);
				alert("Referral error: Check console for details.");
			}
		}
		// Helper to update the balance
		async function payReferrer(uid, bonus, level) {
			const ref = doc(db, "flash-sales", "auth", "users", uid);
			await updateDoc(ref, {

				ib: increment(bonus),
				refPoints: increment(bonus)
			});
			console.log(`✅ ${level} Bonus of ₦${bonus} sent to ${uid}`);
		}
		// 4. RENDER FUNCTIONS
		function renderDeposits(data) {
			const tbody = document.getElementById('depositTableBody');
			tbody.innerHTML = data.map(i => `
                <tr>
                    <td>${i.createdAt ? new Date(i.createdAt.seconds * 1000).toLocaleDateString() : 'Now'}</td>
                    <td><small>${i.userId.substring(0, 7) + '...'}</small></td>
                    <td>₦${Number(i.amount).toLocaleString().substring(0, 8) + '...'}</td>
                    <td><code>${i.refCode.toLocaleString().substring(0, 8) + '...'}</code></td>
                    <td><span class="status-badge ${i.status}">${i.status}</span></td>
                    <td>
                        ${i.status === 'pending' ? `
                            <button class="btn-action" style="background:var(--success)" onclick="handleReferralCommission('${i.userId}','${i.amount}','${i.id}')">✔</button>
                            <button class="btn-action" style="background:var(--danger)" onclick="updateStatus('${i.id}','declined','${i.amount}','${i.userId}')">✖</button>
                        ` : `<button class="btn-action" style="color:var(--danger); background: transparent" onclick="deleteStatus('${i.id}', 'deposits')">✖</butt`}
                    </td>
                </tr>
            `).join('');
		}
		async function renderUsers() {
			const tbody = document.getElementById('userTableBody');
			tbody.innerHTML = "<tr><td colspan='6'>Syncing Database...</td></tr>";

			try {
				// 1. Fetch ALL users first (New & Old)
				const userSnap = await getDocs(collection(db, "flash-sales", "auth", "users"));

				// 2. Fetch ALL deposits/transactions to calculate totals
				const transSnap = await getDocs(collection(db, "flash-sales", "auth", "deposits"));

				// 3. Create a map of transaction data for quick lookup
				let statsMap = {};
				transSnap.forEach(tDoc => {
					const t = tDoc.data();
					if (!statsMap[t.userId]) {
						statsMap[t.userId] = { count: 0, total: 0 };
					}
					statsMap[t.userId].count += 1;
					statsMap[t.userId].total += Number(t.amount || 0);
				});

				tbody.innerHTML = ""; // Clear loader

				userSnap.forEach(docSnap => {
					const u = docSnap.data();
					const uid = docSnap.id;

					// Stats Lookup: Use data if exists, otherwise show "--"
					const hasStats = statsMap[uid];
					const transCount = hasStats ? `${hasStats.count} Trans.` : "--";
					const transTotal = hasStats ? `₦${hasStats.total.toLocaleString()}` : "--";

					// Details Fallbacks
					const name = u.username || u.fullName || "No Name";
					const email = u.email || "No Email";
					const currentStatus = u.status || u.accountStatus || 'Active';
					const isBanned = currentStatus === 'Banned';
					const balance = u.ib !== undefined ? u.ib : 0;
					const tr = document.createElement('tr');

					tr.innerHTML = `
                <td onclick="viewUserDetails('${uid}','${currentStatus}','${name}', '${email}', '${balance}','${u.emailVerified}','${u.createdAt}','${u.refPoints}','${u.referrerId}','${u.referralAwarded}')" style="cursor:pointer">
                    <code style="background:var(--bg); padding:4px 8px; border-radius:5px;">
                        ${uid.substring(0, 8)}... <i class="ri-pencil-line"></i>
                    </code>
                </td>
                <td style="font-size: 0.85rem; color: var(--text-sub);">${transCount}</td>
                <td style="font-weight: bold; color: var(--primary);">${transTotal}</td>
    
                <td>
                    <label class="switch">
                        <input type="checkbox" ${isBanned ? 'checked' : ''} 
                               onchange="toggleBanStatus('${uid}', this.checked)">
                        <span class="slider"></span>
                    </label>
                </td>
                <td onclick="copyAndMove('${uid}')">
                    <i class="ri-arrow-right-up-fill" style="font-size:22px; cursor:pointer; color:var(--text-sub)"></i>
                </td>
            `;
					tbody.appendChild(tr);
				});
			} catch (err) {
				console.error("Master Render Error:", err);
				tbody.innerHTML = "<tr><td colspan='6' style='color:red'>Data Sync Error. Check Console.</td></tr>";
			}
		}

		// 5. ACTIONS
		// --- 2. THE TOGGLE FUNCTION ---
		window.toggleGlobalBankLock = async (isChecked) => {
			try {
				const configRef = doc(db, "flash-sales", "auth", "settings", "config");
				if (!(await verifyAdminBiometric())) return;
				// Update the global flag in Firestore
				await updateDoc(configRef, {
					globalBankLock: isChecked
				});

				// Feedback Toast/Alert
				const statusText = isChecked ? "ACTIVATED (Users Locked)" : "DEACTIVATED (Individual access)";
				alert(`🔒 Master Bank Lock is now ${statusText}`);

			} catch (err) {
				console.error("Update Error:", err);
				alert("Failed to update Master Lock. Check your connection.");
				// Revert UI if it fails
				document.getElementById('masterBankLockToggle').checked = !isChecked;
			}
		};

		const maintenanceRef = doc(db, "flash-sales", "auth", "settings", "maintenance");
		const mToggle = document.getElementById("maintenanceToggle");
		onSnapshot(maintenanceRef, (snap) => {
			if (snap.exists()) {
				const isEnabled = snap.data().enabled;
				// Use .checked property for checkboxes/toggles
				mToggle.checked = isEnabled;
			}
		});

		mToggle.addEventListener("change", async (event) => {
			// 'event.target.checked' gives you the true/false value
			if (!(await verifyAdminBiometric())) return;
			const newState = event.target.checked;
			try {
				await setDoc(maintenanceRef, {
					enabled: newState,
					updatedAt: serverTimestamp()
				}, { merge: true }); // Use merge: true so you don't delete other fields

				console.log("Maintenance mode updated to:", newState);
			} catch (error) {
				console.error("Error updating maintenance mode:", error);
				// Revert the toggle if the database update fails
				mToggle.checked = !newState;
			}
		});

		//bann state
		window.toggleBanStatus = async (uid, isBanned) => {
			const newStatus = isBanned ? 'Banned' : 'Active';
			const statusBadge = document.getElementById(`st-${uid}`);

			try {
				if (!(await verifyAdminBiometric())) return;
				// Update the document in Firebase
				const userRef = doc(db, "flash-sales", "auth", "users", uid);
				await updateDoc(userRef, {
					status: newStatus
				});
				// Update UI visuals
				/*statusBadge.innerText = newStatus;
				statusBadge.className = `status-badge ${isBanned ? 'declined' : 'success'}`;
*/
				console.log(`User ${uid} successfully set to ${newStatus}`);
			} catch (error) {
				console.error("Error updating ban status:", error);
				showModal({
					id: 'detailsPopup',
					title: 'Alert Status',
					content: `
                       <p><strong>Error updating ban status:, ${error}</strong></p>
        `,
					buttons: [
						{
							text: 'Close',
							class: 'btn-sec',
							onclick: "document.getElementById('detailsPopup').remove()"
						}]
				});
			}renderUsers();
		};

		// Note: I added 'userId' to the arguments so we know who to credit
		window.updateStatus = async (transactionId, status, inputAmt, userId) => {
			if (confirm(`Set this transaction to ${status}?`)) {
				try {
					if (!(await verifyAdminBiometric())) return;
					// 1. Update the Deposit Transaction status
					await updateDoc(doc(db, "flash-sales", "auth", "deposits", transactionId), { status });

					if (status === 'success') {
						const userRef = doc(db, "flash-sales", "auth", "users", userId);

						// 2. Safely Increment the balance (using Number to avoid the 6000 issue!)
						await updateDoc(userRef, {
							ib: increment(Number(inputAmt))
						});

						// 3. Notify User
						await addDoc(collection(db, "flash-sales", "auth", "notifications"), {
							userId: userId,
							title: "💰 Wallet Credited",
							message: `Wallet credited with ₦${Number(inputAmt).toLocaleString()}`,
							createdAt: serverTimestamp()
						});
					}

					// 4. Success Feedback
					showModal({
						id: 'statusAlert',
						title: 'Success',
						content: `<p><strong>✅ Transaction updated and user credited!</strong></p>`,
						buttons: [{
							text: 'Close',
							class: 'btn-sec',
							onclick: "document.getElementById('statusAlert').remove();"
						}]
					});

				} catch (err) {
					console.error("Update Error:", err);
					alert("Error: " + err.message);
				}
			}
		};

		window.deleteStatus = async (id, location) => {
			if (confirm(`This action will revert changes on the analysis dashboard but no effect on the user dashboard except for pending transactions..`)) {
				if (!(await verifyAdminBiometric())) return;
				await deleteDoc(doc(db, "flash-sales", "auth", location, id));
			}
		};

		window.filterDeposits = () => {
			const term = document.getElementById('adminSearch').value.toLowerCase();
			const filtered = allData.filter(i => i.userId.toLowerCase().includes(term) || i.refCode.toLowerCase().includes(term));
			renderDeposits(filtered);
		};

		window.exportCSV = () => {
			let csv = "Date,User,Amount,Ref,Status\n";
			allData.forEach(i => csv += `${new Date(i.createdAt?.seconds * 1000).toLocaleDateString()},${i.userId},${i.amount},${i.refCode},${i.status}\n`);
			const blob = new Blob([csv], { type: 'text/csv' });
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'Report.csv';
			a.click();
		};

		// 6. FORM HANDLERS
		window.processAdjustment = async (actionType) => {
			const uid = document.getElementById('crUserId').value.trim();
			const inputAmt = Number(document.getElementById('crAmount').value);
			if (!uid) return alert("Please enter a User ID");
			if (inputAmt <= 0) return alert("Amount must be greater than ₦0.00");
			if (inputAmt >= 15000) return alert("Amount must not be greater than ₦15,000.00");

			const label = actionType === 'credit' ? "Credit" : "Debit";
			if (!confirm(`Are you sure you want to ${label} ₦${inputAmt.toLocaleString()}?`)) return;

			try {
				const userRef = doc(db, "flash-sales", "auth", "users", uid);
				const userSnap = await getDoc(userRef);

				if (!userSnap.exists()) throw new Error("User ID not found.");

				const currentBal = Number(userSnap.data().ib || 0);
				let updateData = {};

				if (actionType === 'credit') {
					// Standard Increment for Credits
					updateData = { ib: increment(inputAmt) };
				} else {
					// 🛑 DEBIT LOGIC WITH 0-FLOOR CHECK
					// If current balance is 100 and you debit 500, newBal becomes 0
					const newBal = Math.max(0, currentBal - inputAmt);
					updateData = { ib: newBal };
				}

				// 1. Update the Balance
				await updateDoc(userRef, updateData);

				// 2. Log Transaction (using inputAmt for the record)
				await addDoc(collection(db, "flash-sales", "auth", "deposits"), {
					userId: uid,
					amount: inputAmt,
					type: label,
					status: "success",
					refCode: (actionType === 'credit' ? "CR-" : "DR-") + Math.floor(Math.random() * 100000),
					createdAt: serverTimestamp(),
					method: "Admin Adjustment"
				});

				// 3. Notify User
				await addDoc(collection(db, "flash-sales", "auth", "notifications"), {
					userId: uid,
					title: actionType === 'credit' ? "💰 Wallet Credited" : "📉 Wallet Debited",
					message: actionType === 'credit' ?
						`Admin credited your account with ₦${inputAmt.toLocaleString()}.` : `Admin debited your account. Your new balance is ₦${Math.max(0, currentBal - inputAmt).toLocaleString()}.`,
					createdAt: serverTimestamp()
				});

				showModal({
					id: 'detailsPopup',
					title: 'Alert Status',
					content: `
                       <p><strong>✅ ${label} Successful!</strong></p>
        `,
					buttons: [
						{
							text: 'Close',
							class: 'btn-sec',
							onclick: "document.getElementById('detailsPopup').remove()"
						}]
				});
				document.getElementById('crAmount').value = "";

			} catch (err) {
				showModal({
					id: 'detailsPopup',
					title: 'Alert Status',
					content: `
                       <p><strong>Error: ${err.message}</strong></p>
        `,
					buttons: [
						{
							text: 'Close',
							class: 'btn-sec',
							onclick: "document.getElementById('detailsPopup').remove()"
						}]
				});
			} finally { }
		};


		// Real-time listener for the share list in Admin
		onSnapshot(query(collection(db, "flash-sales", "auth", "shares"), orderBy("price")), (snap) => {
			let html = "";
			snap.forEach(docSnap => {
				const d = docSnap.data();
				html += `<tr>
            <td>${d.name}</td>
            <td></td>
            <td>₦${d.price.toLocaleString()}</td>
            <td>₦${d.dailyIncome.toLocaleString()}</td>
            <td><button class="btn-action" style="background:var(--danger)" onclick="deleteShare('${docSnap.id}')">✖</button></td>
                              
        </tr>`;
			});
			document.getElementById('shareListTable').innerHTML = html;
		});
		window.deleteShare = async (id) => {
			if (confirm("Delete this share?")) {
				if (!(await verifyAdminBiometric())) return;
				await deleteDoc(doc(db, "flash-sales", "auth", "shares", id));
			}
		};
		// --- THEME ENGINE ---
		window.setTheme = (theme, el) => {
			document.documentElement.setAttribute('data-theme', theme);
			document.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active'));
			if (el) el.classList.add('active');

			localStorage.setItem('exempe-theme', theme);
		};

		// Load saved theme
		setTheme(savedTheme);
		// Helper to copy ID and switch tabs
		window.copyAndMove = (uid) => {
			showModal({
				id: 'topUpModal',
				title: '💎 Top-up Option',
				content: `
                            <div class="input-group">
                                <label>User ID</label>
                                <input type="text" id="crUserId" placeholder="Paste UID here" required>
                            </div>
                            <div class="input-group">
                                <label>Amount (₦)</label>
                                <input type="number" id="crAmount" placeholder="0.00" required>
                            </div>
        <p style="font-size:0.8rem; color:var(--text-sub);">Effects will be seen on user balance</p>
        `,
				buttons: [
					{
						text: '➖ Debit',
						class: 'btn-submit declined red',
						onclick: "processAdjustment('debit')"
					},
					{
						text: '➕ Credit',
						class: 'btn-submit',
						onclick: "processAdjustment('credit')"
					}]
			});

			navigator.clipboard.writeText(uid);
			//alert("UserID Copied! Moving to Credit Tab...");
			// Auto-paste is restricted by browsers, so we just focus the input
			document.getElementById('crUserId').value = uid;
			document.getElementById('crAmount').focus();
		};

		//depositamountmodal
		window.openAddDepositAmtModal = () => {
			showModal({
				id: 'addDepositModal',
				title: '💎 Add Deposit Option',
				content: `
            <label>Amount (₦)</label>
            <div class="input-group">
              <input type="number" id="newDepAmt" class="m-input" required placeholder="e.g. 5000">
            </div>
        <p style="font-size:0.8rem; color:var(--text-sub);">This amount will appear on the user's deposit screen.</p>
        `,
				buttons: [
					{
						text: 'Cancel',
						class: 'btn-sec',
						onclick: "document.getElementById('addDepositModal').remove()"
					},
					{
						text: 'Save Amount',
						class: 'btn-submit',
						onclick: "saveDepositAmount()"
					}]
			});
		};

		window.openCreateSharesModal = () => {
			showModal({
				id: 'createSharesModal',
				title: '📈 Create New Share',
				content: `
            <div class="input-group">
                <label>Share Image</label>
                <input type="file" id="sImage" accept="image/*" style="padding: 10px 0;">
            </div>
            <div class="input-group">
                <label>Share Name</label>
                <input type="text" id="sName" required placeholder="e.g. Bronze Package">
            </div>
            <div class="input-group">
                <label>Price (₦)</label>
                <input type="number" id="sPrice" required>
            </div>
            <div class="input-group">
                <label>Daily Income (₦)</label>
                <input type="number" id="sDaily" required>
            </div>
            <div class="input-group">
                <label>Duration (Days)</label>
                <input type="number" id="sDuration" required>
            </div>
        `,
				buttons: [
					{ text: 'Cancel', class: 'btn-sec', onclick: "document.getElementById('createSharesModal').remove()" },
					{ text: 'Create Share', id: 'submitBtn', class: 'btn-submit', onclick: "createShareAmount()" }
				]
			});
		}

		window.createShareAmount = async () => {
			const fileInput = document.getElementById('sImage');
			const submitBtn = document.getElementById('submitBtn');

			if (!fileInput.files[0]) return alert("Please select an image!");

			/*	submitBtn.innerText = "Uploading Image...";
				submitBtn.disabled = true;*/

			try {
				// 1. Prepare Image for ImgBB
				const formData = new FormData();
				formData.append("image", fileInput.files[0]);

				// 2. Upload to ImgBB
				const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
					method: "POST",
					body: formData
				});
				const imgData = await response.json();

				if (!imgData.success) throw new Error("Image upload failed");

				const imageUrl = imgData.data.url; // This is the direct link to the image

				// 3. Save to Firebase
				await addDoc(collection(db, "flash-sales", "auth", "shares"), {
					name: document.getElementById('sName').value,
					price: Number(document.getElementById('sPrice').value),
					dailyIncome: Number(document.getElementById('sDaily').value),
					duration: Number(document.getElementById('sDuration').value),
					img: imageUrl, // Saving the URL here
					createdAt: serverTimestamp()
				});

				// 4. Success Alert
				document.getElementById('createSharesModal').remove();
				alert("New Share added with image! 🚀");

			} catch (err) {
				console.error(err);
				alert("Error: " + err.message);
			} finally {
				/*		submitBtn.disabled = false;
						submitBtn.innerText = "Create Share";*/
			}
		}
		// --- SAVE NEW DEPOSIT AMOUNT ---
		window.saveDepositAmount = async () => {
			const amtInput = document.getElementById('newDepAmt');
			const amount = Number(amtInput.value);

			if (!amount || amount <= 0) {
				return alert("❌ Please enter a valid amount greater than 0.");
			}

			const saveBtn = document.querySelector("#addDepositModal .btn-submit");
			saveBtn.innerText = "Saving...";
			saveBtn.disabled = true;

			try {
				// Path: flash-sales (coll) -> auth (doc) -> depositAmt (sub-coll)
				const colRef = collection(db, 'flash-sales', 'auth', 'depositAmt');

				// We add a new document for every amount
				await addDoc(colRef, {
					amount: amount,
					createdAt: serverTimestamp()
				});

				showModal({
					id: 'detailsPopup',
					title: 'Status Alert',
					content: `
                       <p><strong>✅ Success! ₦${amount.toLocaleString()} added to deposit presets.</strong></p>
        `,
					buttons: [
						{
							text: 'Close',
							class: 'btn-sec',
							onclick: "document.getElementById('detailsPopup').remove()"
						}]
				});

				document.getElementById('addDepositModal').remove();
				fetchAdminDepositList(); // <--- Add this line to refresh the list instantly

				// Optional: Refresh your admin list if you are displaying them
				if (typeof fetchAdminDepositList === "function") fetchAdminDepositList();

			} catch (error) {
				console.error("Error saving amount:", error);
				showModal({
					id: 'detailsPopup',
					title: 'Status Alert',
					content: `
                       <p><strong>Failed to save amount. Check console</strong></p>
        `,
					buttons: [
						{
							text: 'Close',
							class: 'btn-sec',
							onclick: "document.getElementById('detailsPopup').remove()"
						}]
				});
			} finally {
				saveBtn.innerText = "Save Amount";
				saveBtn.disabled = false;
			}
		}


		// --- FETCH AND DISPLAY PRESETS ---
		window.fetchAdminDepositList = async () => {
			const listDiv = document.getElementById('presetsList');
			listDiv.innerHTML = "<p style='font-size:0.8rem;'>Loading...</p>";

			try {
				const colRef = collection(db, 'flash-sales', 'auth', 'depositAmt');
				// 🚀 THE FIX: Create a query that orders by the 'amount' field
				const q = query(colRef, orderBy("amount", "asc"));
				const querySnapshot = await getDocs(q);

				listDiv.innerHTML = ""; // Clear loader

				if (querySnapshot.empty) {
					listDiv.innerHTML = "<p style='font-size:0.8rem; color:var(--text-sub);'>No Deposits found. (CLick the add icon to create)</p>";
					return;
				}

				querySnapshot.forEach((docSnap) => {
					const data = docSnap.data();
					const docId = docSnap.id;

					const badge = document.createElement('div');
					badge.style = `
                background: var(--bg); border: 1px solid var(--border);
                padding: 8px 10px; border-radius: 8px; display: flex;
                align-items: center; gap: 4px; font-weight: bold;
            `;

					badge.innerHTML = `
                <span style="color:var(--success); cursor:pointer; font-size:.7rem;font-weight:normal">₦${Number(data.amount).toLocaleString()}</span>
                <i class="ri-delete-bin-line" 
                   onclick="deletePreset('${docId}', ${data.amount})" 
                   style="color:var(--danger); cursor:pointer; font-size:.9rem;font-weight:normal"></i>
            `;
					listDiv.appendChild(badge);
				});

			} catch (error) {
				console.error("Error fetching presets:", error);
			}
		};

		// --- DELETE A PRESET ---
		window.deletePreset = async (id, val) => {
			if (!confirm(`Remove ₦${val.toLocaleString()} from deposit options?`)) return;

			try {
				if (!(await verifyAdminBiometric())) return;
				await deleteDoc(doc(db, 'flash-sales', 'auth', 'depositAmt', id));
				showModal({
					id: 'detailsPopup',
					title: 'Status Alert',
					content: `
                       <p><strong>Removed successfully!</strong></p>
        `,
					buttons: [
						{
							text: 'Close',
							class: 'btn-sec',
							onclick: "document.getElementById('detailsPopup').remove()"
						}]
				});
				fetchAdminDepositList(); // Refresh the list
			} catch (error) {
				showModal({
					id: 'detailsPopup',
					title: 'Status Alert',
					content: `
                       <p><strong>Error deleting: ${error.message}</strong></p>
        `,
					buttons: [
						{
							text: 'Close',
							class: 'btn-sec',
							onclick: "document.getElementById('detailsPopup').remove()"
						}]
				});
			}
		};

		// Call this function once when the page loads
		fetchAdminDepositList();

		const configRef = doc(db, "flash-sales", "auth", "settings", "config");
		onSnapshot(configRef, (snap) => {
			if (snap.exists()) {
				window.currentConfig = snap.data();
				fillSettings(snap.data());
			}
		});

		function fillSettings(data) {
			document.getElementById('initBal').value = data.initBal || "";
			document.getElementById('descText').value = data.siteAbout || "";
			document.getElementById('waLink').value = data.whatsappLink || "";
			document.getElementById('tgLink').value = data.telegramLink || "";
			document.getElementById('logoPreview').src = data.siteLogo || "";
			document.getElementById('siteNameInput').value = data.siteName || "";
			document.getElementById('signinAmt').value = data.dailyCheckInAmount || 0;
			// Map the referral array back to the 3 inputs
			if (data.referralPercents) {
				document.getElementById('ref1').value = data.referralPercents[0] || 0;
				document.getElementById('ref2').value = data.referralPercents[1] || 0;
				document.getElementById('ref3').value = data.referralPercents[2] || 0;
			}
		}

		document.getElementById('rulesForm').onsubmit = async (e) => {
			e.preventDefault();
			const siteName = document.getElementById('siteNameInput').value;
			const fileInput = document.getElementById('logoFileInput');
			const file = fileInput.files[0];
			const btn = e.target.querySelector('button');
			const desc = document.getElementById('descText').value;
			const wa = document.getElementById('waLink').value;
			const tg = document.getElementById('tgLink').value;
			const initBal = document.getElementById('initBal');
			if (!(await verifyAdminBiometric())) return;

			try {
				let logoUrl = null;

				// If a new file is selected, upload it to ImgBB
				if (file) {
					const formData = new FormData();
					formData.append("image", file);

					const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
						method: "POST",
						body: formData
					});

					const result = await response.json();
					if (result.success) {
						logoUrl = result.data.url; // This is your permanent link
					} else {
						throw new Error("ImgBB Upload Failed");
					}
				}

				// 3. Save to Firestore Config
				const configRef = doc(db, "flash-sales", "auth", "settings", "config");

				const newConfig = {
					siteName: siteName,
					siteAbout: desc,
					whatsappLink: wa,
					telegramLink: tg,
					initBal: Number(initBal.value),
					dailyCheckInAmount: Number(document.getElementById('signinAmt').value),
					referralPercents: [
						Number(document.getElementById('ref1').value),
						Number(document.getElementById('ref2').value),
						Number(document.getElementById('ref3').value)
					],
					lastUpdated: serverTimestamp()
				};


				if (logoUrl) newConfig.siteLogo = logoUrl; // Only update logo if a new one was uploaded
				//		await updateDoc(configRef, updateData);
				await setDoc(configRef, newConfig, { merge: true });
				showModal({
					id: 'detailsPopup',
					title: 'Configuration Alert',
					content: `
                      <strong>Configuration successfuly saved</strong>
                       <p>✅ Branding updated! Logo and site name are now live</p>
        `,
					buttons: [
						{
							text: 'Close',
							class: 'btn-sec',
							onclick: "document.getElementById('detailsPopup').remove()"
						}]
				});
			} catch (err) {
				console.error(err);
				alert("Error updating branding. Check your API key or connection.");
			} finally {
				btn.disabled = false;
				btn.innerText = "Save Identity";
			}
		};


		window.openCreateUserModal = () => {
			showModal({
				id: 'createModal', // Unique ID for this modal
				title: '➕ Create New User',
				content: `
            <div class="input-group">
                <label>Full Name</label>
                <input type="text" id="newUserName" class="m-input" placeholder="e.g. John Doe">
            </div>
            <div class="input-group">
                <label>Email Address</label>
                <input type="email" id="newUserEmail" class="m-input" placeholder="user@exempe.com">
            </div>
            <div class="input-group">
                <label>Initial Balance (₦)</label>
                <input type="number" id="newUserBal" class="m-input" placeholder="1000">
            </div>
                        <div class="input-group">
                <label>Password Default (123456)</label>
                <input type="number" placeholder="Can only be modify when logged in as a user" class="m-input" value="123456"  disabled>
            </div>
        `,
				buttons: [
					{
						text: 'Cancel',
						class: 'btn-sec',
						onclick: "document.getElementById('createModal').remove()"
					},
					{
						text: 'Register User',
						class: 'btn-submit',
						onclick: "saveNewUserLogic()" // This calls the database function below
					}]
			});
		};

		window.saveNewUserLogic = async () => {
			const name = document.getElementById('newUserName').value.trim();
			const email = document.getElementById('newUserEmail').value.trim();
			const bal = Number(document.getElementById('newUserBal').value);
			const password = "123456";

			if (!name || !email) return alert("❌ Please provide name and email.");
			if (!(await verifyAdminBiometric())) return;
			const saveBtn = document.querySelector("#createModal .btn-submit") || document.querySelector("#createModal .btn-submit");

			// Notice: We don't need the "Logout Warning" anymore!
			if (confirm(`Create user with default password: ${password}?`)) {
				saveBtn.innerText = "Creating Account...";
				saveBtn.disabled = true;

				try {
					// 🚀 KEY CHANGE: Use secondaryAuth here
					const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
					const user = userCredential.user;

					// Save to Firestore (using primary db is fine)
					await setDoc(doc(db, "flash-sales", "auth", "users", user.uid), {
						role: "user",
						username: name,
						email: user.email,
						userid: user.uid,
						ib: bal,
						refPoints: 0,
						referrerId: 'Flash sales' || null,
						referralAwarded: false,
						emailVerified: false,
						hasDeposited: false,
						status: "Active",
						createdAt: serverTimestamp()
					});

					// 🚀 CRUCIAL STEP: Sign out of the SECONDARY instance immediately
					// This ensures the secondary door stays clean for the next user creation
					await signOut(secondaryAuth);


					showModal({
						id: 'detailsPopup',
						title: 'Alert Status',
						content: `
                       <p><strong>✅ Success! User ${name} created.\nUID: ${user.uid});</strong></p>
        `,
						buttons: [
							{
								text: 'Close',
								class: 'btn-sec',
								onclick: "document.getElementById('detailsPopup').remove()"
							}]
					});
					renderUsers(); // Refresh the user list
					if (document.getElementById('createModal')) {
						document.getElementById('createModal').remove();
					}

				} catch (err) {
					console.error("Secondary Auth Error:", err);
					showModal({
						id: 'detailsPopup',
						title: 'Alert Status',
						content: `
                       <p><strong>Error: ${err.message}</strong></p>
        `,
						buttons: [
							{
								text: 'Close',
								class: 'btn-sec',
								onclick: "document.getElementById('detailsPopup').remove()"
							}]
					});
				} finally {
					saveBtn.innerText = "Register User";
					saveBtn.disabled = false;
				}
			}
		};
		window.viewUserDetails = (uid, currentStatus, name, email, bal, eV, cA, rP, rC, rA) => {
			let isBanned = currentStatus === 'Banned';
			showModal({
				id: 'detailsPopup',
				title: 'User Profile',
				content: `
        <div id="profileContainer" style="position:relative; text-align:center; margin-bottom:15px;">
            <button id="editProfileBtn" onclick="toggleProfileEdit('${uid}')" 
                style="position:absolute; right:0; top:0; background:var(--bg); border:none; padding:8px; border-radius:50%; cursor:pointer; color:var(--primary); box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                <i class="ri-pencil-line" style="font-size:20px;"></i>
            </button>

            <i class="ri-user-fill" style="font-size:50px; color:var(--primary)"></i>
            
            <div style="margin-top:10px;" id="editableFields">
                <p style="display:flex;justify-content:space-between"><strong>ID:</strong> <span>${uid}</span></p>
                 <p style="display:flex;justify-content:space-between"><strong>Email:</strong> <span>${email}</span></p>
				 <p style="display:flex;justify-content:space-between"><strong>Verified:</strong> <span>${eV}</span></p>
                <p style="display:flex;justify-content:space-between"><strong>Referred by:</strong> <span>${rC}</span></p>
				 <p style="display:flex;justify-content:space-between"><strong>Status:</strong><span id="st-${uid}" class="status-badge ${isBanned ? 'declined' : 'success'}">
                        ${currentStatus}
                    </span></p>
				<p style="display:flex;justify-content:space-between"><strong>Name:</strong> <span class="edit-field" id="edit-username">${name}</span></p>
                <p style="display:flex;justify-content:space-between"><strong>Balance (IB):</strong> <span class="edit-field" id="edit-ib">${bal}</span></p>
                <p style="display:flex;justify-content:space-between"><strong>Referral Points:</strong> <span class="edit-field" id="edit-refPoints">${rP}</span></p>
               	</div>
        </div>
        `,
				buttons: [
					{
						text: 'Close',
						class: 'btn-sec',
						onclick: "document.getElementById('detailsPopup').remove()"
					},
					{
						text: 'Delete User',
						class: 'btn-sec declined red',
						onclick: "purgeUser('" + uid + "')"
					}]
			});
		};

		window.toggleProfileEdit = (uid) => {
			const btn = document.getElementById('editProfileBtn');
			const fields = document.querySelectorAll('.edit-field');
			const isEditing = fields[0].contentEditable === 'true';

			if (!isEditing) {
				fields.forEach(f => {
					f.contentEditable = 'true';
					f.style.background = 'rgba(67, 24, 255, 0.05)';
					f.style.borderBottom = '2px solid var(--primary)';

					// PREVENT ENTER KEY
					f.onkeydown = (e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							saveUserProfile(uid); // Save automatically on Enter
						}
					};
				});
				btn.innerHTML = '<i class="ri-save-line" style="font-size:20px;"></i>';
				btn.style.color = 'var(--success)';
				btn.onclick = () => saveUserProfile(uid);
			}
		};

		window.saveUserProfile = async (uid) => {
			const btn = document.getElementById('editProfileBtn');
			btn.disabled = true;

			try {
				// Clean the data: remove currency symbols and whitespace
				const cleanNum = (id) => {
					const val = document.getElementById(id).innerText.replace(/[^\d.]/g, '');
					return val === "" ? 0 : Number(val);
				};

				const updateData = {
					username: document.getElementById('edit-username').innerText.trim(),
					//	emailVerified: document.getElementById('edit-eV').innerText.trim(),
					ib: cleanNum('edit-ib'),
					refPoints: cleanNum('edit-refPoints')
				};

				await updateDoc(doc(db, "flash-sales", "auth", "users", uid), updateData);

				// Visual Feedback
				btn.innerHTML = '<i class="ri-checkbox-circle-line"></i>';
				setTimeout(() => {
					document.getElementById('detailsPopup').remove();
					renderUsers(); // Refresh the main table
				}, 1000);

			} catch (err) {
				console.error("Update Error:", err);
				alert("Failed to update: " + err.message);
				btn.disabled = false;
			}
		};
		window.purgeUser = async (userId) => {
			if (!confirm("CRITICAL: This will delete the profile and all transaction history. Proceed? Contact developer to assist in clearing this account logs.")) return;

			try {
				// 1. Delete Profile
				if (!(await verifyAdminBiometric())) return;
				await deleteDoc(doc(db, "flash-sales", "auth", "users", userId));

				// 2. (Optional) Delete their history - you'd need to loop through collections
				// This keeps your database clean!
				alert("User purged successfully.");
				location.reload();
			} catch (err) {
				console.error(err);
			}
		};

		let withdrawalListener = null; // Variable to track the active listener
		// --- 1. THE DYNAMIC LISTENER ---
		window.loadWithdrawals = (field = 'createdAt', direction = 'desc') => {
			// If a listener is already running, stop it first
			if (withdrawalListener) {
				withdrawalListener();
			}

			const q = query(
				collection(db, "flash-sales", "auth", "withdrawals"),
				orderBy(field, direction)
			);

			// Start the new live listener
			withdrawalListener = onSnapshot(q, (snap) => {
				const tbody = document.getElementById('withdrawTable');
				let html = "";

				let totalWithdrawalValue = 0; // To track the sum for the bar chart
				let pieStats = { success: 0, pending: 0, declined: 0 }; // For the doughnut

				if (snap.empty) {
					tbody.innerHTML = '<tr><td colspan="7">No withdrawal requests found.</td></tr>';
					return;
				}

				snap.forEach(docSnap => {
					const d = docSnap.data();
					const amount = Number(d.amount || 0);

					totalWithdrawalValue += amount;

					// 2. Accumulate for the PIE CHART (Doughnut)
					if (d.status === 'success') pieStats.success++;
					else if (d.status === 'pending') pieStats.pending++;
					else if (d.status === 'declined') pieStats.declined++;



					const id = docSnap.id;
					const date = d.createdAt?.toDate().toLocaleDateString() || '--';

					html += `
                <tr onclick="viewWithdrawalDetails('${id}')" >
                    <td style="color:var(--primary);">
                        ${d.userId.substring(0, 8)}...
                    </td>
                    <td>${d.username || 'N/A'}</td>
                    <td>₦${Number(d.amount).toLocaleString()}</td>
                    <td><small>${date}</small></td>
                    <td><span class="status-badge ${d.status}">${d.status.toUpperCase()}</span></td>
                    <td>
						<button class="declined red" onclick="deleteStatus('${id}', 'withdrawals')" style="background:var(--danger); padding: 5px; border-radius: 5px; color:white; border:none; cursor:pointer; margin-left:5px;">
                         <i class="ri-delete-bin-4-line"></i>
                        </button>
                    </td>
                </tr>`;
				});

				tbody.innerHTML = html;
				// Update Bar Chart (Index 0 is Deposits, Index 1 is Withdrawals)
				if (barChart) {
					barChart.data.datasets[0].data[1] = totalWithdrawalValue;
					barChart.update();
				}

				// Update Doughnut Chart
				if (pieChart) {
					pieChart.data.datasets[0].data = [pieStats.success, pieStats.pending, pieStats.declined];
					pieChart.update();
				}

			}, (err) => {
				console.error("Sorting Error:", err);
				alert("Sort failed. You might need to click the link in the console to create a Firestore index.");
			});
		};

		// --- 2. TRIGGER FUNCTION FOR DROPDOWN ---
		window.changeWdSort = () => {
			const val = document.getElementById('wdSortOrder').value; // e.g. "amount-desc"
			const [field, direction] = val.split('-');
			loadWithdrawals(field, direction);
		};

		// Start with default sort on page load
		loadWithdrawals('createdAt', 'desc');

		// --- VIEW BANK DETAILS & ACTION MODAL ---
		window.viewWithdrawalDetails = async (reqId) => {
			try {
				const snap = await getDoc(doc(db, "flash-sales", "auth", "withdrawals", reqId));
				if (!snap.exists()) return alert("Request not found!");

				const d = snap.data();
				const bank = d.bankDetails || {};
				const isPending = d.status === 'pending';

				showModal({
					id: 'wdDetailModal',
					title: 'Withdrawal Detail',
					content: `
                <div style="text-align:left;">
                    <p><strong>User Name:</strong> ${d.username || 'Unknown'}</p>
                  <p><strong>Track ID:</strong> ${d.userId.substring(0,10)+'...' || 'Unknown'}</p>
                  <strong>User Bal: ₦${(d.remainingBalance || 0).toLocaleString()}</strong>
                  <p><strong>Status:</strong> <span class="status-badge ${d.status}">${d.status.toUpperCase()}</span></p>
                    
                    <div style="background:var(--bg); padding:15px; border-radius:15px; margin:15px 0; border:1px solid var(--border);">
                        <p style="color:var(--primary); font-weight:bold; margin-bottom:10px; border-bottom:1px solid var(--border); padding-bottom:5px;">BANK ACCOUNT</p>
                        <p><strong>Bank:</strong> ${bank.bankName || 'N/A'}</p>
                        <p><strong>Number:</strong> ${bank.accountNumber || 'N/A'}</p>
                        <p><strong>Name:</strong> ${bank.accountName || 'N/A'}</p>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,200,81,0.1); padding:10px; border-radius:10px;">
                        <span style="font-size:0.85rem;">Payable Amount:</span>
                        <span style="font-size:1.2rem; font-weight:bold; color:var(--success);">₦${Number(d.netAmount || d.amount).toLocaleString()}</span>
                    </div>
                </div>
            `,
					buttons: isPending ? [
						{
							text: 'Refund',
							class: 'btn-sec',
							style: 'background:#ff4444; color:white;',
							onclick: `processAction('${reqId}', 'declined', ${d.amount}, '${d.userId}')`
						},
						{
							text: '✅ Pay Now',
							class: 'btn-submit',
							style: 'background:#00c851;',
							onclick: `processAction('${reqId}', 'success')`
						}] : [{ text: 'Close', class: 'btn-sec', onclick: "document.getElementById('wdDetailModal').remove()" }]
				});
			} catch (err) {
				alert("Error fetching details: " + err.message);
			}
		};


		window.processAction = async (reqId, status, refundAmt, userId) => {
			try {
				const reqRef = doc(db, "flash-sales", "auth", "withdrawals", reqId);
				const snap = await getDoc(reqRef);

				if (!snap.exists()) return alert("Withdrawal not found.");

				const data = snap.data();
				const bank = data.bankDetails || {};
				//let mail = userId.email;
				// =============================
				// DECLINE + REFUND
				// =============================
				if (status === "declined") {
					if (!confirm("Are you sure you want to DECLINE and refund this user?")) return;

					// Refund user balance
					const userRef = doc(db, "flash-sales", "auth", "users", userId);
					await updateDoc(userRef, {
						ib: increment(Number(refundAmt))
					});

					// Update withdrawal status
					await updateDoc(reqRef, {
						status: "declined",
						processedAt: serverTimestamp()
					});

					alert("✅ Withdrawal declined and balance refunded.");
					//location.reload();
					return;
				}

				// =============================
				// SUCCESS (PAYMENT)
				// =============================
				if (status === "success") {

					// 1. VALIDATION: Check if we have a bank code in the database
					// You must ensure your DB saves the 'bankCode' (e.g., 058, 044) not just the name.
					/*if (!bank.bankCode) {
						return alert("❌ Error: Bank Code is missing for this user. Cannot process payout.");
					}
					*/
					if (!confirm(`Send ₦${Number(data.netAmount || data.amount).toLocaleString()} to ${bank.bankName} (${bank.accountNumber})?`))
						return;

					const settingsSnap = await getDoc(doc(db, "flash-sales", "auth", "settings", "payment"));
					const secretKey = settingsSnap.data()?.korapay?.secretKey;

					if (!secretKey) return alert("Secret Key missing in settings!");
					//to be removed earlier
		await updateDoc(reqRef, {
			status: "success",
			//transactionRef: result.data.reference, // Save the ref
			processedAt: serverTimestamp()
		});
		
		alert("💸 Payout Successful! Money sent.");
		
					const amount = Number(data.netAmount || data.amount);
					// 2. THE API CALL
					/*
					const response = await fetch("https://api.korapay.com/merchant/api/v1/transactions/disburse", {
						method: "POST",
						headers: {
							"Authorization": `Bearer ${secretKey}`,
							"Content-Type": "application/json"
						},
						body: JSON.stringify({
							reference: "WDR_" + reqId + "_" + Date.now(), // Unique Ref
							destination: {
								type: "bank_account",
								amount: amount,
								currency: "NGN",
								narration: "Recieved from Fitch program",
								bank_account: {
									bank: /*bank.bankCode/'033', // FIXED: Uses the dynamic code from DB
									account: /*bank.accountNumber* "0000000000"
								},
								customer: {
									email: data.email || 'support64@gmail.com' // Korapay often requires an email
								}
							}
						})
					});

					const result = await response.json();

					console.log("Korapay Response:", result); // Check Console for details

					if (result.status === true && (result.data.status === "success" || result.data.status === "processing")) {

						await updateDoc(reqRef, {
							status: "success",
							transactionRef: result.data.reference, // Save the ref
							processedAt: serverTimestamp()
						});

						alert("💸 Payout Successful! Money sent.");
						location.reload();
					} else {
						// detailed error message
						alert("❌ Payout Failed: " + (result.message || JSON.stringify(result.data)));
					}*/
				}

				document.getElementById("wdDetailModal")?.remove();

			} catch (err) {
				console.error("Action Error:", err);
				// Check if it is a CORS error
				if (err.message.includes("Failed to fetch")) {
					alert("❌ Network Error (CORS): Korapay blocked the browser request. You must move this logic to a Backend.");
				} else {
					alert("Failed to process: " + err.message);
				}
			}
		};

		/*
						window.approveWithdrawalAuto = async (withdrawalId, userData) => {
							// 1. Get your Secret Key from settings
							const settingsSnap = await getDoc(doc(db, "flash-sales", "auth", "settings", "payment"));
							const secretKey = settingsSnap.data()?.korapay?.secretKey; // Make sure you save this in Admin!
				
							if (!secretKey) return alert("Secret Key missing in settings!");
				
							const confirmPay = confirm(`Send ₦${userData.amount} to ${userData.bankName} (${userData.accNum})?`);
							if (!confirmPay) return;
				
							try {
								// 2. Call Korapay Payout API
								const response = await fetch("https://api.korapay.com/merchant/api/v1/transactions/disburse", {
									method: "POST",
									headers: {
										"Authorization": `Bearer ${secretKey}`,
										"Content-Type": "application/json"
									},
									body: JSON.stringify({
										"reference": "WDR_" + Date.now(),
										"amount": userData.amount,
										"currency": "NGN",
										"destination": {
											"type": "bank_account",
											"amount": userData.amount,
											"currency": "NGN",
											"bank_account": {
												"bank": userData.bankCode, // You need the bank's code (e.g., '058' for GTB)
												"account_number": userData.accNum
											}
										}
									})
								});
				
								const result = await response.json();
				
								if (result.status === true && result.data.status === 'success') {
									// 3. Update Firestore if Payout was successful
									await updateDoc(doc(db, "flash-sales", "auth", "withdrawals", withdrawalId), {
										status: 'success',
										processedAt: serverTimestamp()
									});
									alert("💸 Payout Successful! Money sent.");
									location.reload();
								} else {
									alert("❌ Payout Failed: " + (result.message || "Check Korapay Balance"));
								}
				
							} catch (err) {
								console.error("Payout Error:", err);
								alert("System Error during payout.");
							}
						};*/
		// 1. Preview Logo before upload
		window.previewLogo = (input) => {
			const preview = document.getElementById('logoPreview');
			if (input.files && input.files[0]) {
				const reader = new FileReader();
				reader.onload = (e) => {
					preview.src = e.target.result;
					preview.style.display = 'block';
				}
				reader.readAsDataURL(input.files[0]);
			}
		}

		// --- OPEN SETTINGS MODAL ---
		window.openWithdrawSettings = async () => {
			try {
				// Fetch current settings from Firestore
				const configSnap = await getDoc(doc(db, "flash-sales", "auth", "settings", "config"));
				const cfg = configSnap.data() || { minWithdraw: 2000, withdrawFee: 100 };

				showModal({
					id: 'settingsModal',
					title: '⚙️ Withdrawal Rules',
					content: `
                <div class="input-group" style="margin-bottom:15px;">
                    <label style="display:block; margin-bottom:5px; font-size:0.85rem;">Min. Withdrawal (₦)</label>
                    <input type="number" id="setMinWd" class="m-input" value="${cfg.minWithdraw}">
                </div>
                <div class="input-group">
                    <label style="display:block; margin-bottom:5px; font-size:0.85rem;">Service Fee (%)</label>
                    <input type="number" id="setWdFee" class="m-input" value="${cfg.withdrawFee}">
                    <p style="font-size:0.7rem; color:var(--text-sub); margin-top:5px;">This is the amount subtracted from every withdrawal request.</p>
                </div>
            `,
					buttons: [
						{ text: 'Cancel', class: 'btn-sec', onclick: "document.getElementById('settingsModal').remove()" },
						{ text: 'Save', class: 'btn-submit', onclick: "saveWithdrawConfig()" }
					]
				});
			} catch (err) {
				alert("Error loading settings: " + err.message);
			}
		};

		// --- SAVE SETTINGS LOGIC ---
		window.saveWithdrawConfig = async () => {
			const min = Number(document.getElementById('setMinWd').value);
			const fee = Number(document.getElementById('setWdFee').value);

			const saveBtn = document.querySelector("#settingsModal .btn-submit");
			saveBtn.innerText = "Saving...";
			if (!(await verifyAdminBiometric())) return;
			try {
				await setDoc(doc(db, "flash-sales", "auth", "settings", "config"), {
					minWithdraw: min,
					withdrawFee: fee,
					updatedAt: serverTimestamp()
				}, { merge: true });
				showModal({
					id: 'detailsPopup',
					title: 'Configuration Alert',
					content: `
                       <p><strong>Configuration successfuly saved</strong></p>
        `,
					buttons: [
						{
							text: 'Close',
							class: 'btn-sec',
							onclick: "document.getElementById('detailsPopup').remove()"
						}]
				});
				document.getElementById('settingsModal').remove();
			} catch (err) {
				alert("Failed to save: " + err.message);
			}
		}

		//closing
	} else {
		/*
				showModal({
					id: 'detailsPopup',
					title: 'Alert Status',
					content: `
							   <strong>Session expired, Please Authenticate</strong>
				`,
					buttons: [
					{
						text: 'Close',
						class: 'btn-sec',
						onclick: "document.getElementById('detailsPopup').remove()"
					}]
				});*/
		showTab("login")

	}
})

// 2. NAVIGATION
window.showTab = (tabId, el) => {
	document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
	document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
	document.getElementById(tabId).classList.add('active');
	if (el) {
		el.classList.add('active');
	}
};

/**
 * @param {Object} cfg - Configuration object
 * @param {string} cfg.id - Unique ID for the modal
 * @param {string} cfg.title - Header text
 * @param {string} cfg.content - The HTML body of the modal
 * @param {Array} cfg.buttons - Array of button objects {text, class, onclick}
 */
window.showModal = (cfg) => {
	// 1. Cleanup old versions
	const old = document.getElementById(cfg.id);
	if (old) old.remove();

	// 2. Create Wrapper
	const overlay = document.createElement('div');
	overlay.id = cfg.id;
	overlay.className = 'modal-overlay';
	overlay.style = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); display: flex; align-items: center;
        justify-content: center; z-index: 9999; backdrop-filter: blur(8px);
        animation: fadeIn 0.3s ease;
    `;

	// 3. Generate Buttons HTML
	const buttonsHTML = (cfg.buttons || []).map(btn => `
        <button class="${btn.class || 'btn-submit'}" 
                onclick="${btn.onclick}" 
                style="${btn.style || ''}">${btn.text}</button>
    `).join('');

	// 4. Create Card
	const card = document.createElement('div');
	card.className = "modal-card";
	card.style = `
        background: var(--card); color: var(--text);max-width: ${cfg.width || '450px'};
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        border: 1px solid var(--border); transform: scale(1);
    `;
	card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h3 style="margin:0; font-size:1.4rem;">${cfg.title}</h3>
            <span onclick="document.getElementById('${cfg.id}').remove()" style="cursor:pointer; opacity:0.5; font-size:1.5rem;">&times;</span>
        </div>
        <div class="modal-body" style="margin-bottom:25px;">${cfg.content}</div>
        <div class="modal-footer" style="display:flex; gap:12px; justify-content:flex-end;">
            ${buttonsHTML}
        </div>
    `;
	overlay.appendChild(card);
	document.body.appendChild(overlay);
	// Close on click outside
	overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
};

// ===========================
// COOKIE HELPERS
// ===========================
function setCookie(name, value, hours) {
	const expires = new Date();
	expires.setTime(expires.getTime() + (hours * 60 * 60 * 1000));
	document.cookie =
		name + "=" + value +
		";expires=" + expires.toUTCString() +
		";path=/;SameSite=Strict";
}


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
window.logoutAdmin = async function () {

	//await signOut(auth);
	lastBiometricVerification = 0;
	deleteCookie(SESSION_NAME);

	showTab("login");
};


// ===========================
// LOGIN
// ===========================
window.handleAdminLogin = async function (e) {
	e.preventDefault();
	let email = document.getElementById("adminEmail").value;
	let password = document.getElementById("adminPass").value;
	const btn = document.getElementById("loginBtn");

	try {

		btn.innerText = "Securing Session...";

		// Persist login across browser close
		await setPersistence(auth, browserLocalPersistence);

		const { user } =
			await signInWithEmailAndPassword(auth, email, password);
		const adminRef =
			doc(db, "flash-sales", "auth", "admins", user.uid);

		const adminSnap =
			await getDoc(adminRef);
		if (!adminSnap.exists()) {
			await signOut(auth);
			alert("Unauthorized");
			return;
		}


		// ===========================
		// BIOMETRIC AUTH
		// ===========================
		/*
		if (window.PublicKeyCredential) {

			const available =
				await PublicKeyCredential
					.isUserVerifyingPlatformAuthenticatorAvailable();

			if (available) {

				const savedCredentialId =
					adminSnap.data().credentialId;


				if (savedCredentialId) {

					await navigator.credentials.get({

						publicKey: {

							challenge: randomBuffer(),

							allowCredentials: [{

								id: Uint8Array.from(
									atob(savedCredentialId),
									c => c.charCodeAt(0)
								),

								type: "public-key"
							}],

							userVerification: "required"
						}
					});

				}

				else {

					const credential =
						await navigator.credentials.create({

							publicKey: {

								challenge: randomBuffer(),

								rp: { name: "Flash-sales" },

								user: {
									id: randomBuffer(16),
									name: email,
									displayName: email
								},

								pubKeyCredParams: [
									{ type: "public-key", alg: -7 }
								],

								authenticatorSelection: {
									authenticatorAttachment: "platform",
									userVerification: "required"
								}
							}
						});


					await updateDoc(adminRef, {

						credentialId: btoa(
							String.fromCharCode(
								...new Uint8Array(credential.rawId)
							)
						)
					});
				}
			}
		}*/

		// ===========================
		// SET COOKIE SESSION
		// ===========================
		setCookie(
			SESSION_NAME,
			user.uid,
			SESSION_HOURS
		);

		showTab("analytics-tab");
		//password = "";
		btn.innerText = "Login";
		showModal({
			id: 'detailsPopup',
			title: 'Alert Status',
			content: `
                      <strong>Authentication successfully, Lets proceed</strong>
        `,
			buttons: [
				{
					text: 'Close',
					class: 'btn-sec',
					onclick: "document.getElementById('detailsPopup').remove()"
				}]
		});
		window.location.reload()
	}
	catch (err) {

		alert(err.message);

		btn.innerText = "Login";
	}
}

// ===============================
// SECURE RESET FUNCTION
// ===============================
window.resetBrandingSecure = async () => {

	try {
		const user = auth.currentUser;
		if (!user) {
			alert("Not authenticated");
			return;
		}

		const confirmReset =
			confirm("Verify fingerprint to reset all saved settings. Continue?");

		if (!confirmReset) return;

		const btn =
			document.getElementById("resetBrandingBtn");

		if (btn) {
			btn.disabled = true;
			btn.innerText = "Verifying...";
		}

		// ===============================
		// Get admin credential from Firestore
		// ===============================
		const adminRef =
			doc(db, "flash-sales", "auth", "admins", user.uid);

		const adminSnap =
			await getDoc(adminRef);


		if (!adminSnap.exists()) {
			alert("Admin record not found");
			return;
		}

		if (!(await verifyAdminBiometric())) return;
		// ===============================
		// If success → reset branding
		// ===============================
		btn.innerText = "Resetting...";

		const configRef =
			doc(db, "flash-sales", "auth", "settings", "config");

		const defaultConfig = {
			siteName: "Flash",
			siteLogo: "",
			siteAbout: "",
			whatsappLink: "",
			telegramLink: "",
			initBal: 0,
			dailyCheckInAmount: 0,
			referralPercents: [0, 0, 0],
			lastUpdated: serverTimestamp()
		};

		await setDoc(configRef, defaultConfig, { merge: false });

		showModal({
			id: 'detailsPopup',
			title: 'Reset Complete',
			content: `<strong>Branding reset successful</strong>`,
			buttons: [
				{
					text: 'OK',
					class: 'btn-submit',
					onclick: "document.getElementById('detailsPopup').remove()"
				}]
		});
		document.getElementById("rulesForm").reset();
	}
	catch (err) {
		console.error(err);
		//alert("Fingerprint verification failed or cancelled");
	}
	finally {
		const btn =
			document.getElementById("resetBrandingBtn");
		if (btn) {
			btn.disabled = false;
			btn.innerText = "Reset Branding";
		}

	}

};

// 1. Helper to fill inputs when a preset is clicked
window.applyPreset = (mode, primary, secondary) => {
	document.getElementById('themeMode').value = mode;
	document.getElementById('primaryColor').value = primary;
	document.getElementById('secondaryColor').value = secondary;
	// Optional: Auto-save immediately for "Click & Go"
	saveThemeConfig();
	//	alert(`Selected: ${mode} mode with ${primary}`);
};

// 2. Save to Firestore
window.saveThemeConfig = async () => {
	const btn = event.target;
	//btn.innerText = "Publishing...";

	try {
		const themeConfig = {
			mode: document.getElementById('themeMode').value,
			primary: document.getElementById('primaryColor').value,
			secondary: document.getElementById('secondaryColor').value,
			lastUpdated: serverTimestamp()
		};
		const configRef = doc(db, "flash-sales", "auth", "settings", "config");

		// Merge true ensures we don't delete your referral rates
		await setDoc(configRef, { theme: themeConfig }, { merge: true });

		alert("✅ Theme Updated! Users will see it immediately.");
	} catch (err) {
		console.error(err);
		alert("Failed to update theme.");
	} finally {
		//btn.innerText = "Save Theme Changes";
	}
};// --- LOAD SAVED THEME SETTINGS ---
window.loadThemeSettings = async () => {
	try {
		console.log("Fetching theme preferences...");
		const configRef = doc(db, "flash-sales", "auth", "settings", "config");
		const snap = await getDoc(configRef);

		if (snap.exists() && snap.data().theme) {
			const t = snap.data().theme;
			// 1. Update the Dropdown
			if (t.mode) document.getElementById('themeMode').value = t.mode;

			// 2. Update the Color Pickers
			if (t.primary) document.getElementById('primaryColor').value = t.primary;
			if (t.secondary) document.getElementById('secondaryColor').value = t.secondary;

			console.log("✅ Theme settings loaded.");
		}
	} catch (err) {
		console.error("Error loading theme:", err);
	}
};

window.openCreateNewsModal = async () => {
	const configRef = doc(db, "flash-sales", "auth", "settings", "config");
	const snap = await getDoc(configRef);

	showModal({
		id: 'createNewsModal',
		title: 'Make Announcement ',
		content: `
          <div class="input-group"
                    style="margin-top: 15px; border-top: 1px solid rgba(0,0,0,0.1); padding-top: 10px;">				
                    <textarea id="announcementText" placeholder="Enter news here..."
                        style="width:100%; height:60px; border-radius:8px; padding:10px; margin-top:5px;"></textarea>
          <div style="display:flex; gap:10px;">
           			 <label>📢 Enable Global Announcement</label>
						<label class="switch">
                                        <input type="checkbox" id="showAnnouncement" onchange="saveAnnouncement()">
                                        <span class="slider"></span>
                                    </label>
                </div></div>
        `,
		buttons: [
			{ text: 'Cancel', class: 'btn-sec', onclick: "document.getElementById('createNewsModal').remove()" },
			{ text: 'Announce', id: 'submitBtn', class: 'btn-submit', onclick: "saveAnnouncement()" }
		]
	});

	if (snap.exists()) {
		const t = snap.data().theme;
		if (snap.data().announcement) {
			document.getElementById('announcementText').value = snap.data().announcement.text || "";
			document.getElementById('showAnnouncement').checked = snap.data().announcement.active || false;
		}
	}
}
window.saveAnnouncement = async () => {
	const configRef = doc(db, "flash-sales", "auth", "settings", "config");
	await setDoc(configRef, {
		announcement: {
			text: document.getElementById('announcementText').value,
			active: document.getElementById('showAnnouncement').checked
		}
	}, { merge: true });
	//alert("Announcement updated!");
};


window.openBindBankModal = async () => {
	showModal({
		id: 'createBankModal',
		title: 'Payments Configuration',
		content: `
          <div class="card" style="margin-top: 20px;">
                                    <div class="input-group">
                                        <label>Active Deposit Mode</label>
                                        <select id="depositMode" onchange="togglePaymentFields()">
                                            <option value="manual">Manual Bank Transfer (Admin Approves)</option>
                                            <option value="korapay">Korapay Automatic (Instant Credit)</option>
                                        </select>
                                    </div>

                                    <div id="manualSettings">
                                        <div class="input-group">
                                            <label>Bank Name</label>
                                            <input type="text" id="adminBankName" placeholder="e.g. OPay">
                                        </div>
                                        <div class="input-group">
                                            <label>Account Number</label>
                                            <input type="text" id="adminAccNum" placeholder="e.g. 8123456789">
                                        </div>
                                        <div class="input-group">
                                            <label>Account Name</label>
                                            <input type="text" id="adminAccName" placeholder="e.g. Zaddy Enterprise">
                                        </div>
                                    </div>

                                    <div id="korapaySettings" style="display: none;">
                                        <div class="input-group">
                                            <label>Korapay Public Key (Safe to share)</label>
                                            <input type="text" id="koraPublicKey" placeholder="pk_live_...">
                                        </div>
                             <div class="input-group">      
							     <label>Secret Key (for Withdrawals)</label>
                    <input type="password" id="koraSecretKey" placeholder="sk_live_..." style="width:100%; margin-bottom:10px; padding:10px;">
                    </div>
                    <p style="font-size: 11px; color: red; background: #fff0f0; padding: 8px; border-radius: 5px;">
                        ⚠️ <b>Security:</b> The Secret Key is used to send money out. Never share this with anyone!
                    </p>
                                    </div>
									<div style="display:flex; gap:20px;margin-top:10px">
           				 <label style="font-size: 12px;">📢 Disable Users Bank Details Update</label>
						 <label class="switch">
                                        <input type="checkbox" id="masterBankLockToggle"
                                            onchange="toggleGlobalBankLock(this.checked)">
                                        <span class="slider"></span>
                                    </label>
                </div>
                                </div> `,
		buttons: [
			{ text: 'Cancel', class: 'btn-sec', onclick: "document.getElementById('createBankModal').remove()" },
			{ text: 'Configure', id: 'submitBtn', class: 'btn-submit', onclick: "savePaymentSettings()" }
		]
	});
	loadPaymentSettings();
	try {
		const configSnap = await getDoc(doc(db, "flash-sales", "auth", "settings", "config"));
		if (configSnap.exists()) {
			const isLocked = configSnap.data().globalBankLock || false;
			document.getElementById('masterBankLockToggle').checked = isLocked;
		}
	} catch (err) {
		console.error("Sync Error:", err);
	}
}
// SAVE SETTINGS
window.togglePaymentFields = function () {

	const mode = document.getElementById('depositMode').value;
	document.getElementById('manualSettings').style.display = mode === 'manual' ? 'block' : 'none';
	document.getElementById('korapaySettings').style.display = mode === 'korapay' ? 'block' : 'none';
}

window.savePaymentSettings = async () => {
	try {
		const mode = document.getElementById('depositMode').value;
		const config = {
			mode: mode,
			manual: {
				bankName: document.getElementById('adminBankName').value,
				accountNumber: document.getElementById('adminAccNum').value,
				accountName: document.getElementById('adminAccName').value
			},
			korapay: {
				publicKey: document.getElementById('koraPublicKey').value,
				secretKey: document.getElementById('koraSecretKey').value // Saving the Secret Key
			}
		};

		// Save to a specific document for global settings
		await setDoc(doc(db, "flash-sales", "auth", "settings", "payment"), config, { merge: true });
		showModal({
			id: 'detailsPopup',
			title: 'Bank Alert Status',
			content: `
					   <p><strong>Payment settings successfuly saved</strong></p>
		`,
			buttons: [
				{
					text: 'Close',
					class: 'btn-sec',
					onclick: "document.getElementById('detailsPopup').remove()"
				}]
		});
	} catch (e) {
		console.error(e);
		alert("Error saving settings.");
	}
};

// LOAD SETTINGS (Call this when Admin Panel opens)
window.loadPaymentSettings = async () => {
	const docSnap = await getDoc(doc(db, "flash-sales", "auth", "settings", "payment"));
	if (docSnap.exists()) {
		const data = docSnap.data();
		document.getElementById('depositMode').value = data.mode || 'manual';

		// Populate Manual
		if (data.manual) {
			document.getElementById('adminBankName').value = data.manual.bankName || '';
			document.getElementById('adminAccNum').value = data.manual.accountNumber || '';
			document.getElementById('adminAccName').value = data.manual.accountName || '';
		}

		// Populate Korapay
		if (data.korapay) {
			document.getElementById('koraPublicKey').value = data.korapay.publicKey || '';
			document.getElementById('koraSecretKey').value = data.korapay.secretKey || '';
		}
		togglePaymentFields(); // Ensure correct fields are shown
	}
};


