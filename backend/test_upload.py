import requests

image_path = input("Enter the path to your image file: ").strip()

url = "http://localhost:8000/api/upload-image"

try:
    with open(image_path, "rb") as img:
        files = {"file": (image_path.split("/")[-1], img, "image/jpeg")}
        response = requests.post(url, files=files)
    print("Status Code:", response.status_code)
    print("Response:", response.json())
    if response.status_code == 200 and "file_url" in response.json():
        print("Open this URL in your browser to view the image:")
        print(response.json()["file_url"])
except Exception as e:
    print(f"Error: {e}")
