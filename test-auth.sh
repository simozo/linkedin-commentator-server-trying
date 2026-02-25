#!/bin/bash
echo "Registering test user..."
curl -s -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}'

echo -e "\nLogging in..."
RES=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}')

echo -e "\nResponse:"
echo $RES
