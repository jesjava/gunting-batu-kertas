// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBIMPwUqPpVbAX_q5sgKzT-HR7KQC1Mh-A",
  authDomain: "aziizdobetter.firebaseapp.com",
  databaseURL: "https://aziizdobetter-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "aziizdobetter",
  storageBucket: "aziizdobetter.firebasestorage.app",
  messagingSenderId: "1074885019014",
  appId: "1:1074885019014:web:a9469be40aee7fc76b9807"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// DOM Elements
const roomContainer = document.getElementById("roomContainer");
const gameContainer = document.getElementById("gameContainer");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const createRoomBtn = document.getElementById("createRoomBtn");
const roomInputContainer = document.getElementById("roomInputContainer");
const createRoomInputContainer = document.getElementById(
  "createRoomInputContainer"
);
const joinPlayerNameInput = document.getElementById("joinPlayerNameInput");
const createPlayerNameInput = document.getElementById("createPlayerNameInput");
const roomIdInput = document.getElementById("roomIdInput");
const joinRoomConfirm = document.getElementById("joinRoomConfirm");
const createRoomConfirm = document.getElementById("createRoomConfirm");
const roomIdDisplay = document.getElementById("roomIdDisplay");
const leaveRoomBtn = document.getElementById("leaveRoomBtn");

// Game variables
const opsi = [`gunting`, `batu`, `kertas`];
let currentRoomId = null;
let isRoomMaker = false;
let playerId = generatePlayerId();
let playerName = "";
let score = {
  win: 0,
  lose: 0,
  tie: 0,
};
let currentSelection = null;
let gameState = "waiting"; // waiting, choosing, roomMakerChose, invitedPlayerChose, bothChose

let resultTextElement = document.querySelector(".text-result");
let iconOptionElement = document.querySelector(".container-icon-option");
let scoreTextElement = document.querySelector(".text-score");

// Event Listeners for Room Management
joinRoomBtn.addEventListener("click", function () {
  roomInputContainer.style.display =
    roomInputContainer.style.display === "none" ? "flex" : "none";
  // Hide create room input when showing join room input
  createRoomInputContainer.style.display = "none";
});

createRoomBtn.addEventListener("click", function () {
  createRoomInputContainer.style.display =
    createRoomInputContainer.style.display === "none" ? "flex" : "none";
  // Hide join room input when showing create room input
  roomInputContainer.style.display = "none";
});

joinRoomConfirm.addEventListener("click", joinRoom);
createRoomConfirm.addEventListener("click", createRoom);
leaveRoomBtn.addEventListener("click", leaveRoom);

// Game Event Listeners
document
  .querySelector(".option-gunting")
  .addEventListener("click", function () {
    selectOption(`gunting`);
  });

document.querySelector(".option-batu").addEventListener("click", function () {
  selectOption(`batu`);
});

document.querySelector(".option-kertas").addEventListener("click", function () {
  selectOption(`kertas`);
});

// Room Management Functions
function generatePlayerId() {
  return "player_" + Math.random().toString(36).substr(2, 9);
}

function generateRoomId() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

function createRoom() {
  playerName = createPlayerNameInput.value.trim();
  if (!playerName) {
    alert("Please enter your name");
    return;
  }

  currentRoomId = generateRoomId();
  isRoomMaker = true;

  const roomData = {
    roomMaker: {
      playerId: playerId,
      playerName: playerName,
      score: { win: 0, lose: 0, tie: 0 },
      currentSelection: null,
    },
    invitedPlayer: null,
    gameState: "choosing",
    createdAt: Date.now(),
  };

  database
    .ref("rooms/" + currentRoomId)
    .set(roomData)
    .then(() => {
      showGameScreen();
      setupRoomListener();
      updateGameStatus("choose your option");
    })
    .catch((error) => {
      console.error("Error creating room:", error);
    });
}

function joinRoom() {
  const roomId = roomIdInput.value.trim().toUpperCase();
  playerName = joinPlayerNameInput.value.trim();

  if (!roomId) {
    alert("Please enter a room ID");
    return;
  }

  if (!playerName) {
    alert("Please enter your name");
    return;
  }

  database
    .ref("rooms/" + roomId)
    .once("value")
    .then((snapshot) => {
      if (snapshot.exists()) {
        const roomData = snapshot.val();
        if (!roomData.invitedPlayer) {
          currentRoomId = roomId;
          isRoomMaker = false;

          // Join as invited player
          return database.ref("rooms/" + roomId).update({
            invitedPlayer: {
              playerId: playerId,
              playerName: playerName,
              score: { win: 0, lose: 0, tie: 0 },
              currentSelection: null,
            },
            gameState: "choosing",
          });
        } else {
          throw new Error("Room is full");
        }
      } else {
        throw new Error("Room not found");
      }
    })
    .then(() => {
      showGameScreen();
      setupRoomListener();
      updateGameStatus("choose your option");
    })
    .catch((error) => {
      console.error("Error joining room:", error);
      alert("Cannot join room: " + error.message);
    });
}

function showGameScreen() {
  roomContainer.style.display = "none";
  gameContainer.style.display = "flex";
  roomIdDisplay.textContent = `Room: ${currentRoomId}`;
  updateScoreElement();
}

function setupRoomListener() {
  database.ref("rooms/" + currentRoomId).on("value", (snapshot) => {
    if (!snapshot.exists()) {
      // Room was deleted
      leaveRoom();
      return;
    }

    const roomData = snapshot.val();
    const newGameState = roomData.gameState || "waiting";

    console.log("Game state changed:", newGameState);
    console.log("Room maker selection:", roomData.roomMaker?.currentSelection);
    console.log(
      "Invited player selection:",
      roomData.invitedPlayer?.currentSelection
    );

    gameState = newGameState;

    // Update scores and player info
    if (isRoomMaker) {
      score = roomData.roomMaker.score || { win: 0, lose: 0, tie: 0 };
      playerName = roomData.roomMaker.playerName || "Room Maker";
    } else {
      score = roomData.invitedPlayer
        ? roomData.invitedPlayer.score || { win: 0, lose: 0, tie: 0 }
        : { win: 0, lose: 0, tie: 0 };
      playerName = roomData.invitedPlayer?.playerName || "Invited Player";
    }

    updateScoreElement(roomData); // Pass roomData to update both players' scores

    // Update game status text based on game state
    switch (gameState) {
      case "waiting":
        updateGameStatus("Waiting for player...");
        break;
      case "choosing":
        updateGameStatus("choose your option");
        resetOptionButtons();
        break;
      case "roomMakerChose":
        if (isRoomMaker) {
          updateGameStatus("Waiting for invited player...");
        } else {
          updateGameStatus("choose your option");
        }
        break;
      case "invitedPlayerChose":
        if (!isRoomMaker) {
          updateGameStatus("Waiting for room maker...");
        } else {
          updateGameStatus("choose your option");
        }
        break;
      case "bothChose":
        // Compare selections and determine winner
        console.log("Both chose - comparing selections");
        compareSelections(roomData);
        break;
    }

    // Highlight selected option if player has chosen
    if (isRoomMaker && roomData.roomMaker?.currentSelection) {
      highlightSelectedOption(roomData.roomMaker.currentSelection);
    } else if (!isRoomMaker && roomData.invitedPlayer?.currentSelection) {
      highlightSelectedOption(roomData.invitedPlayer.currentSelection);
    }
  });
}

function updateGameStatus(text) {
  resultTextElement.innerText = text;
  console.log("Status updated:", text);
}

function selectOption(option) {
  if (!currentRoomId) {
    console.log("Cannot select option - no room ID");
    return;
  }

  // Allow selection only in these states
  if (
    gameState !== "choosing" &&
    gameState !== "roomMakerChose" &&
    gameState !== "invitedPlayerChose"
  ) {
    console.log("Cannot select option - invalid state:", gameState);
    return;
  }

  console.log("Player selected:", option);
  currentSelection = option;
  highlightSelectedOption(option);

  const selectionPath = isRoomMaker
    ? `rooms/${currentRoomId}/roomMaker/currentSelection`
    : `rooms/${currentRoomId}/invitedPlayer/currentSelection`;

  database
    .ref(selectionPath)
    .set(option)
    .then(() => {
      console.log("Selection saved to Firebase");

      // Update game state based on who has chosen
      return database.ref("rooms/" + currentRoomId).once("value");
    })
    .then((snapshot) => {
      const roomData = snapshot.val();

      // Use proper null checks - handle both null and undefined
      const roomMakerChose = roomData.roomMaker.currentSelection != null;
      const invitedPlayerChose =
        roomData.invitedPlayer &&
        roomData.invitedPlayer.currentSelection != null;

      console.log(
        "Room maker chose:",
        roomMakerChose,
        roomData.roomMaker.currentSelection
      );
      console.log(
        "Invited player chose:",
        invitedPlayerChose,
        roomData.invitedPlayer?.currentSelection
      );

      let newGameState = "choosing";
      if (roomMakerChose && !invitedPlayerChose) {
        newGameState = "roomMakerChose";
      } else if (!roomMakerChose && invitedPlayerChose) {
        newGameState = "invitedPlayerChose";
      } else if (roomMakerChose && invitedPlayerChose) {
        newGameState = "bothChose";
      }

      console.log("Updating game state to:", newGameState);
      return database
        .ref("rooms/" + currentRoomId + "/gameState")
        .set(newGameState);
    })
    .catch((error) => {
      console.error("Error selecting option:", error);
    });
}

function highlightSelectedOption(option) {
  // Remove highlight from all buttons
  document.querySelectorAll(".button-option").forEach((button) => {
    button.style.backgroundColor = "transparent";
    button.style.borderColor = "white";
  });

  // Add highlight to selected button
  const selectedButton = document.querySelector(`.option-${option}`);
  if (selectedButton) {
    selectedButton.style.backgroundColor = "rgb(50, 50, 50)";
    selectedButton.style.borderColor = "#4CAF50";
    console.log("Highlighted option:", option);
  }
}

function resetOptionButtons() {
  document.querySelectorAll(".button-option").forEach((button) => {
    button.style.backgroundColor = "transparent";
    button.style.borderColor = "white";
  });
  console.log("Option buttons reset");
}

function compareSelections(roomData) {
  // Use proper null checks for both null and undefined
  const roomMakerSelection = roomData.roomMaker.currentSelection;
  const invitedPlayerSelection = roomData.invitedPlayer?.currentSelection;

  console.log("Comparing selections:");
  console.log("Room maker:", roomMakerSelection);
  console.log("Invited player:", invitedPlayerSelection);

  // Check if both selections are valid (not null and not undefined)
  if (roomMakerSelection == null || invitedPlayerSelection == null) {
    console.log("Missing selections, cannot compare");

    // If we're in bothChose state but missing selections, reset to choosing
    setTimeout(() => {
      database.ref("rooms/" + currentRoomId).update({
        "roomMaker/currentSelection": null,
        "invitedPlayer/currentSelection": null,
        gameState: "choosing",
      });
    }, 1000);
    return;
  }

  // ADD THIS CHECK: Prevent multiple comparisons for the same round
  if (roomData.hasCompared) {
    console.log("Already compared this round, skipping");
    return;
  }

  // Display both selections
  let iconOption = /*html*/ `<img class="option-player" src="icons/${roomMakerSelection}.png" alt="">
  <p>VS</p>
  <img class="option-computer" src="icons/${invitedPlayerSelection}.png" alt="">`;

  iconOptionElement.innerHTML = iconOption;
  iconOptionElement.classList.remove("js-container-icon-option");
  // Force reflow
  void iconOptionElement.offsetWidth;
  iconOptionElement.classList.add("js-container-icon-option");

  console.log("Displayed both selections in VS area");

  // Determine winner based on game logic
  let roomMakerResult = "";
  let invitedPlayerResult = "";

  if (roomMakerSelection === invitedPlayerSelection) {
    // Tie
    roomMakerResult = "tie";
    invitedPlayerResult = "tie";
    updateGameStatus("TIE!");
    console.log("Result: TIE");
  } else if (
    (roomMakerSelection === "gunting" && invitedPlayerSelection === "kertas") ||
    (roomMakerSelection === "batu" && invitedPlayerSelection === "gunting") ||
    (roomMakerSelection === "kertas" && invitedPlayerSelection === "batu")
  ) {
    // Room maker wins
    roomMakerResult = "win";
    invitedPlayerResult = "lose";
    updateGameStatus(isRoomMaker ? "YOU WIN!" : "YOU LOSE!");
    console.log("Result: Room Maker WINS");
  } else {
    // Invited player wins
    roomMakerResult = "lose";
    invitedPlayerResult = "win";
    updateGameStatus(isRoomMaker ? "YOU LOSE!" : "YOU WIN!");
    console.log("Result: Invited Player WINS");
  }

  // Update scores
  const roomMakerScore = { ...roomData.roomMaker.score };
  const invitedPlayerScore = roomData.invitedPlayer
    ? { ...roomData.invitedPlayer.score }
    : { win: 0, lose: 0, tie: 0 };

  if (roomMakerResult === "win") roomMakerScore.win++;
  if (roomMakerResult === "lose") roomMakerScore.lose++;
  if (roomMakerResult === "tie") roomMakerScore.tie++;

  if (invitedPlayerResult === "win") invitedPlayerScore.win++;
  if (invitedPlayerResult === "lose") invitedPlayerScore.lose++;
  if (invitedPlayerResult === "tie") invitedPlayerScore.tie++;

  console.log("Updated scores - Room Maker:", roomMakerScore);
  console.log("Updated scores - Invited Player:", invitedPlayerScore);

  // Update scores in Firebase WITH hasCompared flag
  database
    .ref("rooms/" + currentRoomId)
    .update({
      "roomMaker/score": roomMakerScore,
      "invitedPlayer/score": invitedPlayerScore,
      hasCompared: true, // ADD THIS FLAG
    })
    .then(() => {
      console.log("Scores updated in Firebase");

      // Reset selections and prepare for next round after delay
      setTimeout(() => {
        console.log("Resetting selections for next round");
        database.ref("rooms/" + currentRoomId).update({
          "roomMaker/currentSelection": null,
          "invitedPlayer/currentSelection": null,
          gameState: "choosing",
          hasCompared: false, // RESET THE FLAG
        });
      }, 3000); // Wait 3 seconds before resetting
    })
    .catch((error) => {
      console.error("Error updating scores:", error);
    });
}

function leaveRoom() {
  if (currentRoomId) {
    database
      .ref("rooms/" + currentRoomId)
      .remove()
      .then(() => {
        console.log("Room deleted");
      })
      .catch((error) => {
        console.error("Error deleting room:", error);
      });
    currentRoomId = null;
  }

  // Return to room selection screen
  gameContainer.style.display = "none";
  roomContainer.style.display = "flex";
  roomInputContainer.style.display = "none";
  createRoomInputContainer.style.display = "none";
  roomIdInput.value = "";
  joinPlayerNameInput.value = "";
  createPlayerNameInput.value = "";
  score = { win: 0, lose: 0, tie: 0 };
  currentSelection = null;
  gameState = "waiting";
  resetOptionButtons();
  updateGameStatus("WAITING");
}

// Game Functions - Updated to display both players' scores
function updateScoreElement(roomData) {
  if (!roomData) {
    // If no roomData provided, just show current player's score
    scoreTextElement.innerText = `${playerName} - Win: ${score.win}, Lose: ${score.lose}, Tie: ${score.tie}`;
    return;
  }

  const roomMakerName = roomData.roomMaker?.playerName || "Room Maker";
  const invitedPlayerName =
    roomData.invitedPlayer?.playerName || "Invited Player";

  const roomMakerWin = roomData.roomMaker?.score?.win || 0;
  const invitedPlayerWin = roomData.invitedPlayer?.score?.win || 0;

  scoreTextElement.innerText = `${roomMakerName} - Win: ${roomMakerWin} | ${invitedPlayerName} - Win: ${invitedPlayerWin}`;
}

