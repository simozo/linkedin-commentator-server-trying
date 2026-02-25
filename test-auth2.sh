#!/bin/bash
curl -s -X POST http://localhost:4000/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test2@test.com","password":"password123"}' > /dev/null

curl -s -X POST http://localhost:4000/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test2@test.com","password":"password123"}'
