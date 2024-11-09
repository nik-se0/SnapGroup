from flask import Flask, request, jsonify
import base64
import cv2
import numpy as np
from concurrent.futures import ThreadPoolExecutor
import socket
import logging

app = Flask(__name__)
executor = ThreadPoolExecutor(max_workers=10)

logging.basicConfig(level=logging.DEBUG)

def pixel_compare(image1, image2):
    img1 = cv2.imdecode(np.frombuffer(base64.b64decode(image1), np.uint8), -1)
    img2 = cv2.imdecode(np.frombuffer(base64.b64decode(image2), np.uint8), -1)
    img1 = cv2.resize(img1, (20, 20))
    img2 = cv2.resize(img2, (20, 20))
    difference = cv2.absdiff(img1, img2)
    similarity = 1 - (np.sum(difference) / (img1.shape[0] * img1.shape[1] * 255))
    return similarity * 100

def color_histogram_compare(image1, image2):
    img1 = cv2.imdecode(np.frombuffer(base64.b64decode(image1), np.uint8), -1)
    img2 = cv2.imdecode(np.frombuffer(base64.b64decode(image2), np.uint8), -1)
    hist1 = cv2.calcHist([img1], [0, 1, 2], None, [8, 8, 8], [0, 256, 0, 256, 0, 256])
    hist2 = cv2.calcHist([img2], [0, 1, 2], None, [8, 8, 8], [0, 256, 0, 256, 0, 256])
    cv2.normalize(hist1, hist1)
    cv2.normalize(hist2, hist2)
    similarity = cv2.compareHist(hist1, hist2, cv2.HISTCMP_CORREL)
    return similarity * 100

def compare_images(data):
    image1 = data['image1']
    image2 = data['image2']
    method = data.get('method', 'pixel')
    if  method == 'color_histogram':
        return color_histogram_compare(image1, image2)
    else:
        return pixel_compare(image1, image2)

@app.route('/compare', methods=['POST'])
def compare():
    try:
        data = request.json
        future = executor.submit(compare_images, data)
        similarity = future.result()
        return jsonify({"similarity": similarity})
    except Exception as e:
        logging.error("Error in /compare route: %s", str(e))

def find_free_port(start_port):
    port = start_port
    while True:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('0.0.0.0', port)) != 0:  # порт свободен
                return port
        port +=1

if __name__ == '__main__':
    port = find_free_port(5001)
    app.run(host='0.0.0.0', port=port)
