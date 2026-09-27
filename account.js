const nameInput = document.getElementById("name");
const addressInput = document.getElementById("address");
const phoneInput = document.getElementById("phone");
const profileForm = document.getElementById("profile-form");
const statusMsg = document.getElementById("status");
const profilePhoto = document.getElementById("profile-photo");
const profileDisplayName = document.getElementById("profile-display-name");
const profileEmail = document.getElementById("profile-email");
const saveBtn = document.getElementById("save-btn");

let currentUser = null;

firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    alert("Please log in to view your account.");
    window.location.href = "index.html";
    return;
  }

  currentUser = user;
  
  if (profilePhoto && user.photoURL) {
    profilePhoto.src = user.photoURL;
  }
  if (profileDisplayName) {
    profileDisplayName.textContent = user.displayName || "Customer";
  }
  if (profileEmail) {
    profileEmail.textContent = user.email || "";
  }

  loadProfile(user.email);
});

function loadProfile(email) {
  db.collection("users").doc(email).get().then(doc => {
    if (doc.exists) {
      const data = doc.data();
      nameInput.value = data.name || currentUser.displayName || "";
      addressInput.value = data.address || "";
      phoneInput.value = data.phone || "";
    } else {
      nameInput.value = currentUser.displayName || "";
    }
  }).catch(err => {
    console.error("Failed to load profile:", err);
    statusMsg.textContent = "Failed to load profile.";
    statusMsg.style.color = "var(--danger)";
  });
}

profileForm.onsubmit = (e) => {
  e.preventDefault();

  const name = nameInput.value.trim();
  const address = addressInput.value.trim();
  const phone = phoneInput.value.trim();

  if (!name || !address || !phone) {
    statusMsg.textContent = "Please fill in all fields.";
    statusMsg.style.color = "var(--danger)";
    return;
  }

  saveBtn.disabled = true;
  saveBtn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 1s linear infinite;">
      <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
      <path d="M12 2a10 10 0 0 1 10 10"></path>
    </svg>
    Saving...
  `;

  db.collection("users").doc(currentUser.email).set(
    { name, address, phone, email: currentUser.email },
    { merge: true }
  ).then(() => {
    statusMsg.textContent = "✓ Profile details updated successfully!";
    statusMsg.style.color = "var(--accent-emerald-text)";
    saveBtn.disabled = false;
    saveBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
      Save Profile Details
    `;
    if (typeof window.showToast === "function") {
      window.showToast("Profile details saved successfully!", "success");
    }
  }).catch(err => {
    console.error("Error saving profile:", err);
    statusMsg.textContent = "Failed to update profile. Please try again.";
    statusMsg.style.color = "var(--danger)";
    saveBtn.disabled = false;
    saveBtn.innerHTML = `Save Profile Details`;
  });
};
