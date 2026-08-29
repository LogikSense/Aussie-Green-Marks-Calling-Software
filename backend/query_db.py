import sqlite3

conn = sqlite3.connect('crm_outcalling.db')
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print('=== USERS ===')
cursor.execute('SELECT id, email, full_name, is_active FROM users')
users = cursor.fetchall()
if users:
    for row in users:
        print(f'ID: {row["id"]}, Email: {row["email"]}, Name: {row["full_name"]}, Active: {row["is_active"]}')
else:
    print('No users found')

print('\n=== USER SETTINGS ===')
cursor.execute('SELECT user_id, vapi_api_key, vapi_phone_number_id, vapi_assistant_id, crm_api_key, crm_endpoint FROM user_settings')
settings = cursor.fetchall()
if settings:
    for row in settings:
        print(f'User ID: {row["user_id"]}')
        print(f'  Vapi API Key: {row["vapi_api_key"]}')
        print(f'  Vapi Phone ID: {row["vapi_phone_number_id"]}')
        print(f'  Vapi Assistant ID: {row["vapi_assistant_id"]}')
        print(f'  CRM API Key: {row["crm_api_key"]}')
        print(f'  CRM Endpoint: {row["crm_endpoint"]}')
else:
    print('No settings found')

conn.close()
