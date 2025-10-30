console.log("TEst Video.js has loaded and is running")
// --- 1. CONFIGURATION ---

// ⬇️ PASTE YOUR FIREBASE CONFIG OBJECT HERE ⬇️
const firebaseConfig = {
  apiKey: "AIzaSyBdvLfAuVGVi_PZcujBkbuQV3CI6ZGwX_0",
  authDomain: "design-thinking-project-29898.firebaseapp.com",
  projectId: "design-thinking-project-29898",
  storageBucket: "design-thinking-project-29898.firebasestorage.app",
  messagingSenderId: "251200050785",
  appId: "1:251200050785:web:862e4876623fb850b87c20"
};
// ⬇️ PASTE YOUR RENDER SERVER URL HERE ⬇️
// (Make sure it's just the hostname, e.g., 'my-peer-server.onrender.com')
const MY_RENDER_URL = 'cuvlib-backend.onrender.com';

// --- 2. INITIALIZATION ---
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
console.log("Firebase DB object:", db);
const localVideoContainer = document.getElementById('local-video-container');
const localVideo = document.getElementById('local-video');
// Get DOM elements
const videoGrid = document.getElementById('video-grid');
const localAvatar = document.getElementById('local-avatar');
const micBtn = document.getElementById('micBtn1');
const camBtn = document.getElementById('camBtn1');

// Get room ID from URL (e.g., .../meet.html?room=study-group)
const urlParams = new URLSearchParams(window.location.search);
const ROOM_ID = urlParams.get('room');
console.log("Checkpoint 1: My Room ID is:", ROOM_ID); // Your test line
if (!ROOM_ID) {
  alert('No room ID found! Please join with a URL like ?room=my-room-name');
}

// References to our Firebase "guest list"
const roomRef = db.collection('rooms').doc(ROOM_ID);
const usersRef = roomRef.collection('users');

// Initialize PeerJS
// 1. Generate our own ID *first*
const myGeneratedId = 'user-' + Math.random().toString(36).substring(2, 9);
console.log("Checkpoint 2.5: Generated our own ID:", myGeneratedId);

// 2. NOW create the Peer object *using* that ID
const peer = new Peer(myGeneratedId, {
  host: MY_RENDER_URL,
  port: 443,
  path: '/', // Use the root path
  secure: true
});

let myStream;
let myPeerId; // This will get set to myGeneratedId in Checkpoint 3
const connectedPeers = {};
  peer.on('open', (id) => {
    console.log("Checkpoint 3: Peer connection is OPEN. My ID is:", id); // <-- ADD THIS
    myPeerId = id;
    if (myStream) {
    joinRoom(id);
  }

peer.on('error', (err) => {
  // This will show any hidden connection errors
  console.error("PEERJS ERROR:", err);
});
    // Join the "guest list" (Firebase)
    joinRoom(id);
// ...
    // Add ourself to the Firebase "guest list"
    joinRoom(id);

    // Watch for new users joining
    watchForNewUsers(id);
    
    // Watch for users leaving
    watchForUserLeft(id);
  });
// --- 3. CORE LOGIC: GET USER MEDIA & JOIN ---

// ... (around line 63)
navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then(stream => {
  console.log("Checkpoint 2: Got user media (camera/mic)"); // <-- ADD THIS
  myStream = stream;
  addMyVideoStream(stream);
  if (myPeerId) {
  joinRoom(myPeerId);
}
// ...

const myGeneratedId = 'user-' + Math.random().toString(36).substring(2, 9);
console.log("Checkpoint 2.5: Generated our own ID:", myGeneratedId);


  // Listen for incoming calls
  peer.on('call', (call) => {
    console.log('Answering call from', call.peer);
    call.answer(myStream); // Answer with our stream

    // When we get their stream, add it to the page
    call.on('stream', (friendStream) => {
      addRemoteVideoStream(friendStream, call.peer);
    });

    // Store the call object to close it later
    connectedPeers[call.peer] = call;
  });

  // Setup our local mic/cam buttons
  setupLocalControls();

}).catch(err => {
  console.error('Failed to get media', err);
  alert('Could not access camera or microphone.');
});

// --- 4. FIREBASE & PEER FUNCTIONS ---
// ... (around line 102)
function joinRoom(peerId) {
  console.log("Checkpoint 4: Calling joinRoom(). Writing to Firebase..."); // <-- ADD THIS
  // Add ourself to the 'users' collection
  usersRef.doc(peerId).set({
    peerId: peerId,
// ...
    name: 'New User' // You can expand this later (e.g., get name from a prompt)
  });
}

function watchForNewUsers(myId) {
  // Listen for real-time changes
  usersRef.onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        const newPeerId = change.doc.data().peerId;
        if (newPeerId !== myId) {
          console.log('New user joined:', newPeerId);
          // Call the new user
          connectToNewUser(newPeerId, myStream);
        }
      }
    });
  });
}

function connectToNewUser(friendPeerId, stream) {
  console.log(`Calling new user: ${friendPeerId}`);
  
  // Call the friend and send them our stream
  const call = peer.call(friendPeerId, stream);

  // When they send *their* stream, show it
  call.on('stream', (friendStream) => {
    addRemoteVideoStream(friendStream, friendPeerId);
  });

  // Store the call object
  connectedPeers[friendPeerId] = call;
}

function watchForUserLeft(myId) {
  usersRef.onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'removed') {
        const leftPeerId = change.doc.data().peerId;
        if (leftPeerId !== myId) {
          console.log('User left:', leftPeerId);
          // Remove their video box
          document.getElementById(leftPeerId)?.remove();
          // Close the peer connection
          if (connectedPeers[leftPeerId]) {
            connectedPeers[leftPeerId].close();
            delete connectedPeers[leftPeerId];
          }
        }
      }
    });
  });
}

// --- 5. DOM MANIPULATION FUNCTIONS ---

function addMyVideoStream(stream) {
  localVideo.srcObject = stream;
  localVideo.style.display = 'block'; // Show the video
  localAvatar.style.display = 'none'; // Hide the avatar
}

function addRemoteVideoStream(stream, peerId) {
  // Don't add if they're already here
  if (document.getElementById(peerId)) return;

  // Create a new video box based on your HTML template
  const videoBox = document.createElement('div');
  videoBox.className = 'video-box h-64 flex flex-col items-center justify-center relative';
  videoBox.id = peerId; // Use PeerID as the DOM ID

  // Get a random avatar for the remote user
  const randomGender = Math.random() > 0.5 ? 'men' : 'women';
  const randomId = Math.floor(Math.random() * 80);
  const avatarSrc = `https://randomuser.me/api/portraits/${randomGender}/${randomId}.jpg`;

  videoBox.innerHTML = `
    <video autoplay playsinline class="w-full h-full object-cover" style="display: none;"></video>
    <img src="${avatarSrc}" alt="User" class="video-avatar">
    <span class="video-name">User ${peerId.substring(0, 4)}</span>
    `;

  videoGrid.append(videoBox);

  // Find the video tag we *just* created and set its stream
  const remoteVideo = videoBox.querySelector('video');
  const remoteAvatar = videoBox.querySelector('img');
  
  remoteVideo.srcObject = stream;
  remoteVideo.play();
  
  remoteVideo.style.display = 'block';
  remoteAvatar.style.display = 'none';
  
  // You can also add logic here to show/hide avatar
  // if the remote user toggles their video
  stream.getVideoTracks()[0].onended = () => {
    remoteVideo.style.display = 'none';
    remoteAvatar.style.display = 'block';
  };
}

// --- 6. LOCAL CONTROLS ---

function setupLocalControls() {
  let micOn = true;
  let camOn = true;

  micBtn.addEventListener('click', () => {
    micOn = !micOn;
    myStream.getAudioTracks()[0].enabled = micOn; // Toggle the audio track
    
    // Update button icon
    micBtn.innerHTML = micOn
      ? '<i data-feather="mic" class="w-5 h-5"></i>'
      : '<i data-feather="mic-off" class="w-5 h-5 text-red-500"></i>';
    feather.replace();
  });

  camBtn.addEventListener('click', () => {
    camOn = !camOn;
    myStream.getVideoTracks()[0].enabled = camOn; // Toggle the video track
    
    // Update button icon
    camBtn.innerHTML = camOn
      ? '<i data-feather="video" class="w-5 h-5"></i>'
      : '<i data-feather="video-off" class="w-5 h-5 text-red-500"></i>';
    feather.replace();

    // Toggle video/avatar display
    if (camOn) {
      localVideo.style.display = 'block';
      localAvatar.style.display = 'none';
    } else {
      localVideo.style.display = 'none';
      localAvatar.style.display = 'block';
    }
  });
}

// --- 7. LEAVE FUNCTION ---

// Make the handleLeave function available globally
window.handleLeave = () => {
  if (myPeerId) {
    // Remove ourself from the Firebase "guest list"
    usersRef.doc(myPeerId).delete();
  }
  // Stop all media tracks
  myStream.getTracks().forEach(track => track.stop());
  // Close all peer connections
  for (const peerId in connectedPeers) {
    connectedPeers[peerId].close();
  }
  peer.destroy();
};