# VAA1 – User Guide

## 1. Overview

The Video Analysis Tool is a desktop-based application that allows users to upload videos, perform automated analysis using different analysis lenses, and optionally annotate videos using CVAT. The application is designed for simplicity and does not require manual user authentication.

Key characteristics:

* No user login or account management
* Automatic login to CVAT using an administrator account
* Video upload, analysis, result visualization, and download
* Optional video annotation workflow via CVAT

> **Note:** The user interface contains several buttons and controls that are not yet functional. These are part of planned future features.

---

## 2. Application Access and Authentication

* When the application is opened, the user is automatically logged in.
* The application silently authenticates the user into CVAT using a preconfigured **admin account**.
* No login screen or credential input is required.

This behavior is intentional and ensures seamless access to analysis and annotation features.

---

## 3. User Interface Overview

The main interface is composed of the following primary areas:

* **Header**

  * Has several options including file
  * Contains global action buttons (some may be inactive)

* **Panels for different sections**

  * Each panel is named for their functionality
  * See project panel forlisting of uploaded videos, video panel for the actual video and download panel for donwloading results
  * Note than some buttons may not be functional yet

* **Annotation Integration (CVAT)**

  * Enables creation of annotation jobs
  * Redirects users to the CVAT annotation interface

---

## 4. Uploading Videos

To upload a video:

1. See the **Header** section of the application.
2. Click the **File Upload** option.
3. Select a video file from your local system.
4. Once uploaded, the video will appear in the **Project Library Panel**.

Supported video formats depend on the current backend configuration.

---

## 5. Analyzing Videos

To analyze a video:

1. In the **Project Library Panel**, select a video.
2. Click the **Analyze** button below the video preview.
3. The analysis will be executed.
4. Results will appear in the **Analysis Results Panel**.

Each analysis lens produces its own set of results.

---

## 6. Viewing and Downloading Analysis Results

### Viewing Results

* Analysis results are displayed in a dedicated results panel.
* Each analysis lens has its own result section.

### Downloading Results

Users have two download options:

* **Download All Results**

  * Downloads all analysis outputs for the selected video in a single action.

* **Download Individual Results**

  * Allows downloading results from a specific analysis lens only.

Download formats depend on the analysis type and configuration.

---

## 7. Annotating Videos (CVAT Integration)

The application integrates with CVAT for video annotation.

### Creating an Annotation Job

1. Select a video from the **Project Library Panel**.
2. Click the **Annotate** button.
3. This action creates a new CVAT job for the selected video.

### Opening the Annotation Interface

1. After the job is created, click the **Annotate** button again.
2. The application will redirect you to the CVAT annotation page.
3. You can begin annotating the video directly in CVAT.

Because the application automatically logs you into CVAT as an admin, no additional authentication is required. **NOTE** that this project uses CVAT's own UI to load cvat annotation canvas. Annotation canvas may have CVAT's own header and clicking them would navigate the user to outside of VAA1 app.

---

## 8. Non-Functional or Placeholder UI Elements

The interface currently contains multiple buttons and controls that do not yet have implemented functionality.

* These elements are placeholders for future features.
* Clicking them may have no effect or may be disabled.
* Their presence does not impact the core upload, analysis, or annotation workflows.

---

## 9. Known Limitations

* No user accounts or permission management
* CVAT access is shared via a single admin account
* Limited error handling and user feedback in some workflows
* Inactive UI elements may cause confusion

---

## 10. Future Enhancements (Planned)

Potential future improvements include:

* User authentication and role-based access
* Expanded analysis lenses
* Improved result visualization
* Activation of currently inactive UI controls
* Enhanced CVAT integration and job management

---

## 11. Support

For issues, questions, or feature requests, contact the project maintainers.
