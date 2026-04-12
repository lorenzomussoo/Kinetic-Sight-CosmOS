# Kinetic Sight CosmOS

**Kinetic Sight CosmOS** is an experimental multimodal interface designed for the immersive exploration of the Solar System within a web browser. The project focuses on seamless interaction through the integration of three distinct input modalities: **Gaze Tracking**, **Hand Gestures**, and **Voice Commands**.

By decoupling targeting, activation, and property modification, the system provides a fluid, touchless experience that minimizes unintentional interactions and physical strain, making it ideal for educational and public exhibition contexts.

---

## 📁 Project Structure

The repository is organized as follows:

### 🔹 `code/`
Contains the core logic, interface, and interaction managers of the application.
* **`index.html`**: The main entry point. It defines the UI structure, includes the necessary libraries (Three.js, MediaPipe, WebGazer), and sets up the 3D canvas and information overlays.
* **`style.css`**: Defines the visual identity of the project, including the "space-themed" aesthetic, responsive layouts for information panels, and calibration UI.
* **`app.js`**: The heart of the system. It manages the Three.js 3D environment, initializes the planet assets, and synchronizes the Gaze and Hand Tracking inputs to enable object selection.
* **`audiomanager.js`**: Handles all auditory feedback. It includes a Text-to-Speech system for accessibility and generates specific auditory tones (Earcons) to confirm user actions and system status.
* **`voicemanager.js`**: Manages the Web Speech API integration. It listens for vocal commands to modify object properties (color, scale) and navigate through the data panels.
* **`analysis.py`**: A Python script used to process raw logs and survey data to generate analytical charts.

### 🔹 `test/`
Contains the experimental data and protocols used to validate the system's usability.
* **`Tasks.txt`**: The official testing protocol. It contains the three incremental tasks (Exploration, Synergy, and Navigation) used during user studies.
* **`cosmos_test_results.txt`**: Raw logs exported by the internal Data Logger, including time-on-task, missed activations, and voice recognition failures.
* **`Kinetic Sight CosmOS: Usability and Workload Evaluation.csv`**: Aggregated quantitative data from the System Usability Scale (SUS) and NASA-TLX questionnaires.
* **`analysis/`**: A subdirectory containing the generated visualization charts (Learning Curve, Error Reduction, etc.) in .png format.

### 🔹 `textures/`
Contains high-resolution assets for the 3D simulation.
* **4K Planet Textures**: High-fidelity surfaces for all major celestial bodies.
* **Atmospheres & Clouds**: Dynamic layers for Earth and other atmospheric planets.
* **Environmental Assets**: Textures for the Sun and Moon.

---

## 🚀 Getting Started

### 📷 Hardware Recommendations
While the system is fully functional with a standard built-in laptop webcam, for the **optimal ergonomic experience**, we highly recommend a dual-camera setup or the use of an external camera (e.g., an iPhone). 
Positioning an external camera to track the user's hands at desk level allows users to rest their elbows comfortably on the table while performing gestures, completely eliminating physical arm fatigue.

### Prerequisites
To run the project locally, you need a modern web browser with camera and microphone access. Due to security restrictions regarding camera access, the files must be served through a local server.

### Local Setup
1.  Clone the repository:
    ```bash
    git clone [https://github.com/your-username/Kinetic-Sight-CosmOS.git](https://github.com/your-username/Kinetic-Sight-CosmOS.git)
    ```
2.  Navigate to the `code/` folder.
3.  Launch a local server.
4.  Open the application in your browser and follow the on-screen calibration steps for gaze tracking.

---

## 🧪 Researcher Interface (Data Logger)

The system includes a hidden vocal interface for researchers to monitor and export experimental data.

| Command | Action |
| :--- | :--- |
| **"New User"** | Resets the session and adds a separator in the logs. |
| **"Start task [name]"** | Starts the internal timer for a specific mission. |
| **"Finish task"** | Stops the timer and records all errors/metrics. |
| **"Export logs"** | Downloads a .txt file with all session data. |
| **"Clear logs"** | Wipes the browser's local storage for a fresh start. |

---

## 🛠️ Tech Stack
* **Three.js**: 3D Engine for rendering the celestial bodies.
* **MediaPipe Hands**: Real-time hand gesture and pinch detection.
* **WebGazer.js**: Gaze tracking via webcam.
* **Web Speech API**: Voice command recognition and synthesis.
