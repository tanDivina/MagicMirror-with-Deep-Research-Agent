# Magic Mirror: The Autonomous Creative Agency

## 🏆 Kaggle Submission Details

**Track:** Best Use of Gemini API
**Subtitle:** From Bedroom to Billboard with Gemini Live & Deep Research

### Project Description
Magic Mirror is the world's first autonomous creative agency in your pocket. It solves the "blank canvas" problem for e-commerce sellers and creators by transforming raw, low-quality webcam photos into high-end, data-backed ad campaigns in seconds.

The app uses a multimodal "Shoot, Swap, Sell" workflow. Users act as the photographer, using **Gemini Live** to control the camera via natural voice commands hands-free. Once a shot is captured, the **Brand Agent**—powered by **Gemini 3 Pro** and **Google Search Grounding**—conducts deep market research. It identifies target personas, hunts for trending visual styles, and writes authentic copy based on real-time competitor analysis. Finally, the **A/B Lab** simulates market performance by generating a "Challenger" variant based on current trends.

Built with React 19, the app leverages the **Live API** for zero-latency interaction, **Function Calling** for UI control, and **Gemini 3 Pro Image** models for photorealistic compositing. Magic Mirror democratizes professional advertising, reducing the cost of a creative studio to zero.

### How I Created It
I built Magic Mirror as a React 19 application that interacts directly with the Gemini API.

1.  **Hands-Free Control (Live API):** I implemented `gemini-2.5-flash-native-audio` via WebSockets. The model listens to the microphone and uses **Function Calling** (`takePhoto`, `changeVibe`) to trigger the camera shutter and control the React state in real-time.
2.  **Visual Engine:** For the "Remix" feature, I used `gemini-3-pro-image-preview`. It takes the base64 webcam capture and a prompt (e.g., "Marble Studio") to generate high-fidelity commercial assets while preserving the product's text and logos using the new prompt adherence capabilities.
3.  **Deep Research Agents:** I created a multi-step agent loop using `gemini-3-pro-preview` equipped with the `googleSearch` tool. The agent autonomously plans a research strategy, queries Google for real-world trends (e.g., "skincare trends 2025"), and synthesizes the data into a "Persona Brief" and "Copy Kit."
4.  **UI/UX:** The interface uses a custom "Pop-Art" design system with Tailwind CSS, featuring "Kinetic Marquees" and optimistic UI updates to keep the energy high during AI processing.

### Tech Stack
*   **Frontend:** React 19, Tailwind CSS, Lucide React
*   **AI Models:** 
    *   `gemini-2.5-flash-native-audio-preview` (Live Voice Control)
    *   `gemini-3-pro-image-preview` (High-Fidelity Generation)
    *   `gemini-3-pro-preview` (Deep Research & Grounding)
*   **Tools:** Google Search Grounding, Function Calling
