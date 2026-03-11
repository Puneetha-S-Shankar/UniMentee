# services/storage_service.py
import os
from supabase import create_client

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')  # service role key
BUCKET = 'portfolio-documents'

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def generate_upload_url(file_key: str, content_type: str = 'application/pdf'):
    """
    Returns a presigned URL for direct client-side upload.
    file_key example: 'portfolios/student_42/cert_abc.pdf'
    """
    response = supabase.storage.from_(BUCKET).create_signed_upload_url(file_key)
    return {
        'upload_url': response['signedUrl'],
        'file_key': file_key,
        'public_url': supabase.storage.from_(BUCKET).get_public_url(file_key)
    }

def get_public_url(file_key: str):
    return supabase.storage.from_(BUCKET).get_public_url(file_key)
