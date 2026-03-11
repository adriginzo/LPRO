#!/bin/bash

echo "Stopping all application services..."

# Kill Angular dev servers
pkill -f "ng serve"

# Kill NestJS / node dev servers
pkill -f "start:dev"

# Extra safety: kill node processes started in these folders
pkill -f "backend-libraries"
pkill -f "backend-salas"
pkill -f "backend-users"
pkill -f "frontend-users"
pkill -f "frontend-librarian"
pkill -f "admin-salas"

echo "All services stopped."
