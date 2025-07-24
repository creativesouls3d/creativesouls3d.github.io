// account.js

const nameInput = document.getElementById("name");
const addressInput = document.getElementById("address");
const phoneInput = document.getElementById("phone");
const profileForm = document.getElementById("profile-form");
const statusMsg = document.getElementById("status");

let currentUser = null;

firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    alert("Please log in to view your account.");
    window.location.href = "index.html";
    return;
  }

  currentUser = user;
  loadProfile(user.email); // ✅ use email as doc ID
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
    statusMsg.style.color = "red";
  });
}

profileForm.onsubmit = (e) => {
  e.preventDefault();

  const name = nameInput.value.trim();
  const address = addressInput.value.trim();
  const phone = phoneInput.value.trim();

  if (!name || !address || !phone) {
    statusMsg.textContent = "Please fill in all fields.";
    statusMsg.style.color = "red";
    return;
  }

  db.collection("users").doc(currentUser.email).set(
    { name, address, phone, email: currentUser.email },
    { merge: true }
  ).then(() => {
    statusMsg.textContent = "Profile updated successfully!";
    statusMsg.style.color = "green";
  }).catch(err => {
    console.error("Error saving profile:", err);
    statusMsg.textContent = "Failed to update profile.";
    statusMsg.style.color = "red";
  });
};
