import httpx

def test():
    print("Testing hitting the /chunk endpoint on 8000...")
    with open("Hands_On_Machine_Learning_with_Scikit_Learn_Keras_and_Tensorflow.pdf", "rb") as f:
        files = {"file": f}
        data = {"chapter_title": "MNIST", "pre_sliced": "true", "start_page": "113"}
        response = httpx.post("http://127.0.0.1:8000/chunk", files=files, data=data, timeout=120.0)
        print("Status:", response.status_code)
        print("Text:", response.text)

if __name__ == "__main__":
    test()
