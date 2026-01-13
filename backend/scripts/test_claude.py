import boto3
import json
import os

from dotenv import load_dotenv
load_dotenv()

# AWS Credentials from environment
ACCESS_KEY = os.environ.get("AWS_ACCESS_KEY_ID")
SECRET_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY")
SESSION_TOKEN = os.environ.get("AWS_SESSION_TOKEN")
REGION = os.environ.get("AWS_REGION", "eu-central-1")

def test_claude_sonnet():
    try:
        bedrock = boto3.client(
            service_name='bedrock-runtime',
            region_name=REGION,
            aws_access_key_id=ACCESS_KEY,
            aws_secret_access_key=SECRET_KEY,
            aws_session_token=SESSION_TOKEN
        )

        model_id = 'anthropic.claude-3-5-sonnet-20240620-v1:0'
        
        prompt = "Hello, are you Claude 3.5 Sonnet? Please reply with a short confirmation."
        
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1000,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        })

        print(f"Sending request to {model_id} in {REGION}...")
        response = bedrock.invoke_model(
            body=body,
            modelId=model_id,
            accept='application/json',
            contentType='application/json'
        )

        response_body = json.loads(response.get('body').read())
        result_text = response_body['content'][0]['text']
        
        with open("claude_result.txt", "w") as f:
            f.write(result_text)
            
        print("\nSuccessfully saved response to claude_result.txt")

    except Exception as e:
        with open("claude_result.txt", "w") as f:
            f.write(f"Error: {str(e)}")
        print(f"Error: {e}")

if __name__ == "__main__":
    test_claude_sonnet()
