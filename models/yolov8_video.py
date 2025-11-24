import cv2
from ultralytics import YOLO
import csv

# Load the YOLOv8 model (nano model is used here, you can choose 'yolov8n.pt', 'yolov8s.pt', etc.)
model = YOLO('yolov8n.pt')

# Path to your input video file
# video_path = r"C:/Users/mahdi/OneDrive/Documents/Coding101/VAA1/YOLOv8/Helsinki_main_street.mp4"  # Replace with the path to your video file

video_path = r"C:/Users/Amaan/Vaa/The-project/samples/Helsinki_main_street.mp4"  # Replace with the path to your video file

# Open the video file
cap = cv2.VideoCapture(video_path)

# Check if the video file was opened correctly
if not cap.isOpened():
    print("Error: Could not open video.")
    exit()

# Get video properties
frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
fps = cap.get(cv2.CAP_PROP_FPS)

# Define the codec and create a VideoWriter object to save the output
output_path = 'output_video.mp4'
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out = cv2.VideoWriter(output_path, fourcc, fps, (frame_width, frame_height))

# CSV file to store detection results
csv_output_path = 'video_detections.csv'
with open(csv_output_path, mode='w', newline='') as csv_file:
    csv_writer = csv.writer(csv_file)
    # Write the header for the CSV file
    csv_writer.writerow(['Frame', 'Class', 'Confidence', 'X_min', 'Y_min', 'X_max', 'Y_max'])

    # Process each frame from the video
    frame_count = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            print("Reached the end of the video.")
            break

        frame_count += 1

        # Run YOLOv8 on the frame
        results = model(frame)

        # Extract detections and save to CSV
        for detection in results[0].boxes:
            # Get the bounding box coordinates
            x_min, y_min, x_max, y_max = map(int, detection.xyxy[0])  # Convert to integer values
            confidence = float(detection.conf[0])  # Confidence score
            class_id = int(detection.cls[0])  # Class ID
            class_name = model.names[class_id]  # Class name from model's class names

            # Write detection data to the CSV file
            csv_writer.writerow([frame_count, class_name, confidence, x_min, y_min, x_max, y_max])

        # Plot the bounding boxes on the frame
        annotated_frame = results[0].plot()

        # Display the frame with detections
        cv2.imshow('YOLOv8 Video Detection', annotated_frame)

        # Write the annotated frame to the output video
        out.write(annotated_frame)

        # Press 'q' to exit the video early
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

# Release the video capture and writer objects and close display window
cap.release()
out.release()
cv2.destroyAllWindows()
