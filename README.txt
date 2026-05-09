HOTEL BOOKING SYSTEM
README & RUN INSTRUCTIONS

Student: Daniel Lee
Module: 6G6Z0019 Synoptic Project
University: Manchester Metropolitan University

1. Project Overview

This project is a full stack hotel room booking web application developed using React, Vite, and Supabase. The system supports four different user roles: Guest, User, Admin, and Owner. It provides functionality for browsing rooms, making bookings with a live availability calendar, viewing booking history, applying promotional codes, joining a waitlist for fully booked rooms, and accessing an analytics dashboard.

The database is hosted remotely using Supabase, while the frontend runs locally through the Vite development server.

2. Required Software

To run the application, Node.js version 18 or higher and npm version 9 or higher are required

No additional software is required, as the database is hosted on Supabase and does not need to be installed locally.

3. Project Structure

The project is organised into a standard React + Vite structure. The src folder contains the main application code, including the primary component App.jsx and global styling in index.css.

Configuration files such as package.json, vite.config.js, and tailwind.config.js define dependencies and build settings. A .env file is included to have the required environment variables.

open a terminal, navigate to the project directory, and install dependencies using:

cd SynopticProject 
npm install  

This will download all required packages, including React, Supabase client, Vite, Tailwind CSS, Recharts, and React Day Picker.

Once installation is complete, start the development server by running:

npm run dev  

The terminal will display a local URL, typically http://localhost:5173. Open this URL in a web browser to access the application.

6. Test Accounts & Feature Walkthrough

Several test accounts have been preconfigured in the system. These include an Owner account, an Admin account, and multiple User accounts. Credentials are provided alongside the project files.

Users can also access the system as a Guest without logging in. In Guest mode, users can browse available rooms, view room details, and check availability using a calendar interface. However, attempting to make a booking will prompt the user to log in or create an account.

Logged in users can browse rooms, select dates using the calendar, apply promotional codes (such as WELCOME10 or SUMMER20), and confirm bookings. Users can also view active bookings, review booking history, and cancel existing bookings.

Admin users have additional access to an Analytics dashboard, which includes revenue charts, occupancy rates, booking heatmaps, and a CSV export function. The Admin panel also provides a view of all users and booking statistics.

Owner users have full administrative privileges, including the ability to promote other users to admin status.

If all rooms of a particular type are booked, the system allows users to join a waitlist by submitting their email address.

7. Available Promo Codes

The system includes several predefined promotional codes for testing purposes. These include WELCOME10 (10% discount, valid for one year), SUMMER20 (20% discount, valid for six months), and FLASH50 (50% discount, valid for seven days).

8. Database Schema Notes

The database schema is documented in the SQL files located in the sql folder. These scripts illustrate the structure and evolution of the database during development. While they are included for reference, they do not need to be executed, as the live database is already fully configured.

Key tables include Customer Info (user profiles), rooms (room data), bookings (active bookings), booking_history (archived bookings), promo_codes (discount logic), and waitlist (user interest tracking).

Row Level Security (RLS) is enabled on most tables. However, it was disabled for the Customer Info table due to recursion issues encountered during development. Further details can be found in the associated SQL script.

9. Dependencies

The application uses several key dependencies, including React for the user interface, Supabase for backend services, Vite as the development server, Tailwind CSS for styling, Recharts for data visualisation, and React Day Picker for calendar functionality.

A full list of dependencies is available in the package.json file.

10. Known Issues & Limitations

The application is primarily optimised for desktop use, and while it functions on mobile devices, the layout is not fully responsive. Email notifications for bookings and cancellations have not yet been implemented and are identified as future improvements.

Room management functionality (such as adding or editing rooms) is not currently available through the user interface and must be performed directly in the Supabase dashboard. Additionally, the analytics dashboard performs calculations on the client side, which may impact performance with very large datasets.

11. Showcase Video

A 10 minute demonstration video accompanies this project and can be accessed via the provided link:

https://mmutube.mmu.ac.uk/edit/1_l2ls5api

The video demonstrates the system’s features, architecture, database design, implementation details, and evaluation.