@echo off
title PMU Suite
start "PMU API" cmd /k "npm run dev:api"
start "PMU Web" cmd /k "npm run dev:web"
echo Serveurs demarres. Ouvrez http://localhost:5173
