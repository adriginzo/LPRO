#!/bin/bash

echo "Starting all services..."

# Backends
echo "Starting backend-libraries..."
gnome-terminal -- bash -c "cd backend-libraries && npm run start:dev; exec bash"

echo "Starting backend-salas..."
gnome-terminal -- bash -c "cd backend-salas && npm run start:dev; exec bash"

echo "Starting backend-users..."
gnome-terminal -- bash -c "cd backend-users && npm run start:dev; exec bash"

# Frontends
echo "Starting admin-salas..."
gnome-terminal -- bash -c "cd admin-salas && ng serve; exec bash"

echo "Starting frontend-users..."
gnome-terminal -- bash -c "cd frontend-users && npm start; exec bash"

echo "Starting frontend-librarian..."
gnome-terminal -- bash -c "cd frontend-librarian && ng serve; exec bash"

echo "All services launched."