"""
List available AI models.

This script was intended for debugging model availability.
Currently not implemented - use AWS CLI or Azure Portal for model discovery.

Usage:
    python -m backend.scripts.list_models
"""

def main():
    print("Model listing not implemented.")
    print("Use AWS CLI: aws bedrock list-foundation-models --region eu-central-1")
    print("Or check Azure AI Studio for available Flux models.")

if __name__ == "__main__":
    main()
