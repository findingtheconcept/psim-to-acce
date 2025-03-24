
# PSIM to AССE Converter

This project provides a desktop application that converts data from **PSIM** (Excel format) to **ACCE**. The application uses **Flask** as the backend server and **PyWebView** for creating the desktop user interface.

## Features

- **Flask Backend**: Serves the main web page and handles any server-side logic.
- **PyWebView Interface**: A simple, clean user interface for interacting with the application.
- **Excel Handling**: The app processes Excel files using the **openpyxl** library.
- **Real-time Interaction**: Data can be loaded from an Excel file, processed, and saved to a new format.

## Installation

### Prerequisites

- Python 3.x
- A virtual environment for project dependencies

### Setup

1. **Clone this repository**:

    ```bash
    git clone https://your-repository-url.git
    cd psim-to-asse
    ```

2. **Create a virtual environment** (if not already created):

    ```bash
    python -m venv .venv
    ```

3. **Activate the virtual environment**:

    - On Windows:
      ```bash
      .venv\Scripts\activate
      ```
    - On Mac/Linux:
      ```bash
      source .venv/bin/activate
      ```

4. **Install dependencies**:

    Run the following command to install required libraries:

    ```bash
    pip install -r requirements.txt
    ```

## Running the Application

1. **Start the Flask backend and PyWebView frontend**:

    To run the app, simply execute the following command:

    ```bash
    python src/app.py
    ```

2. **Open the application**:
   The application will open a desktop window with the user interface, and you will be able to interact with the converter.

## Dependencies

- **Flask**: Lightweight web framework for Python to handle backend logic.
- **PyWebView**: Used for rendering the web interface inside a desktop window.
- **openpyxl**: Library for reading and writing Excel files.
