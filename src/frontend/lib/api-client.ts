// src/frontend/lib/api-client.ts
import axios from 'axios';

// Create an Axios instance with default settings
// Can be used throughout the frontend application to make API requests to the backend

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
  timeout: 15000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Automatically unwrap .data
api.interceptors.response.use(
  (res) => res.data,
  (error) => {
    console.error("API Error:", error);
    return Promise.reject(error);
  },
);