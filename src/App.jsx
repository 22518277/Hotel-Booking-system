import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import "./index.css";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, Legend
} from "recharts";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ownerEmail = (import.meta.env.VITE_OWNER_EMAIL || "").toLowerCase();

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;


function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "Available now";
  return new Date(value).toISOString().slice(0, 10);
}

function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const ms = new Date(checkOut) - new Date(checkIn);
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function datesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

function bookedDatesFromRanges(ranges) {
  const dates = [];
  for (const { check_in, check_out } of ranges) {
    const start = new Date(check_in);
    const end = new Date(check_out);
    const cur = new Date(start);
    while (cur < end) {
      dates.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
  }
  return dates;
}

function exportToCSV(data, filename) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => JSON.stringify(row[h] ?? "")).join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_NAMES = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];


let _toastId = 0;
let _setToasts = null;

export function toast(message, type = "success") {
  if (!_setToasts) return;
  const id = ++_toastId;
  _setToasts((prev) => [...prev, { id, message, type }]);
  setTimeout(() => {
    _setToasts((prev) => prev.filter((t) => t.id !== id));
  }, 4000);
}

function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  _setToasts = setToasts;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-xl backdrop-blur-sm transition-all animate-slide-in
            ${t.type === "success" ? "border-emerald-500/30 bg-emerald-950/90 text-emerald-300" : ""}
            ${t.type === "error"   ? "border-red-500/30 bg-red-950/90 text-red-300" : ""}
            ${t.type === "info"    ? "border-blue-500/30 bg-blue-950/90 text-blue-300" : ""}
            ${t.type === "warning" ? "border-amber-500/30 bg-amber-950/90 text-amber-300" : ""}
          `}
        >
          <span>
            {t.type === "success" && "✓"}
            {t.type === "error"   && "✕"}
            {t.type === "info"    && "ℹ"}
            {t.type === "warning" && "⚠"}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  );
}



function Skeleton({ className = "" }) {
  return (
    <div className={`animate-pulse rounded-2xl bg-slate-800 ${className}`} />
  );
}

function RoomCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800 overflow-hidden">
      <Skeleton className="h-40 rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-6 w-1/3" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 flex-1" />
        </div>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm overflow-y-auto">
      <div className={`w-full ${wide ? "max-w-3xl" : "max-w-md"} rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl shadow-blue-950/30 my-8`}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-blue-400">{title}</h2>
          <button type="button" onClick={onClose}
            className="rounded-full border border-slate-700 px-3 py-1 text-slate-400 transition hover:bg-slate-800 hover:text-white">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function RoomDetailsModal({ room, roomBookings, onClose, onBook, isLoggedIn, isGuestView }) {
  const unavailableDates = useMemo(() => bookedDatesFromRanges(roomBookings || []), [roomBookings]);

  const amenities = useMemo(() => {
    if (room.amenities) { try { return JSON.parse(room.amenities); } catch {} }
    const type = (room.room_type || "").toLowerCase();
    if (type === "suite" || type.includes("penthouse"))
      return ["King Bed", "Private Balcony", "Jacuzzi", "Mini Bar", "City View", "Butler Service", "Free Wi-Fi", "65\" Smart TV", "Nespresso Machine"];
    if (type === "double" || type.includes("deluxe") || type.includes("superior"))
      return ["Queen Bed", "City View", "Mini Bar", "Free Wi-Fi", "Smart TV", "En-suite Bathroom", "Room Service", "Desk"];
    if (type === "single")
      return ["Single Bed", "Free Wi-Fi", "Smart TV", "En-suite Bathroom", "Desk", "Room Service"];
    return ["Free Wi-Fi", "TV", "En-suite Bathroom", "Room Service"];
  }, [room]);

  const description = useMemo(() => {
    if (room.description) return room.description;
    const type = (room.room_type || "").toLowerCase();
    if (type === "suite")
      return "Indulge in the pinnacle of luxury in our Suite. Featuring a sprawling king size bed, a private balcony with panoramic city views, a marble jacuzzi, and dedicated butler service every detail has been crafted for an unforgettable stay.";
    if (type === "double")
      return "Our Double rooms offer the perfect blend of comfort and practicality. With a queen size bed, modern amenities, it's ideal whether you're travelling for business or leisure.";
    if (type === "single")
      return "Our Single rooms are compact, comfortable, and thoughtfully designed. Everything you need for a restful stay, a cosy single bed, a smart TV, fast Wi-Fi, and a private en-suite bathroom.";
    return `Experience comfort and style in our ${room.room_type}. This well-appointed room offers everything you need for a relaxing stay.`;
  }, [room]);

  return (
    <Modal title="" onClose={onClose} wide>
      <div className="relative -mx-6 -mt-6 mb-6 h-64 overflow-hidden rounded-t-3xl">
        <img src={room.image_url || "https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800"}
          alt={room.room_type} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 to-transparent" />
        <div className="absolute bottom-4 left-6">
          <h2 className="text-2xl font-bold text-white">{room.room_type}</h2>
          <p className="text-sm text-slate-300">Room {room.room_number ?? room.room_id}</p>
        </div>
        <div className="absolute right-4 top-4">
          <span className="rounded-2xl bg-emerald-500/90 px-3 py-1 text-sm font-semibold text-white backdrop-blur-sm">Available</span>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
            <p className="text-sm text-slate-400">Price per night</p>
            <p className="text-3xl font-bold text-blue-400">£{room.price_per_night}</p>
          </div>
          <div>
            <h3 className="mb-2 font-semibold text-white">About this room</h3>
            <p className="text-sm leading-relaxed text-slate-400">{description}</p>
          </div>
          <div>
            <h3 className="mb-3 font-semibold text-white">Amenities</h3>
            <div className="flex flex-wrap gap-2">
              {amenities.map((a) => (
                <span key={a} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300">{a}</span>
              ))}
            </div>
          </div>
        </div>
        <div>
          <h3 className="mb-3 font-semibold text-white">Availability</h3>
          <div className="rounded-2xl border border-slate-700 bg-slate-950 p-3">
            <DayPicker mode="single"
              disabled={[{ before: new Date() }, ...unavailableDates]}
              modifiers={{ booked: unavailableDates }}
              modifiersClassNames={{ booked: "rdp-day--booked" }} />
            <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-red-500/70" />Unavailable</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-emerald-500/70" />Available</span>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={onClose}
          className="flex-1 rounded-2xl border border-slate-700 bg-slate-800 py-3 font-medium text-white transition hover:bg-slate-700">Close</button>
        <button type="button" onClick={() => { onClose(); onBook(); }}
          className="flex-1 rounded-2xl bg-blue-600 py-3 font-medium text-white transition hover:bg-blue-700">
          {isGuestView ? "Sign in to Book" : "Book This Room"}
        </button>
      </div>
    </Modal>
  );
}

function RoomTypeTable({ groupedRooms, allRooms, bookings, search, setSearch, onBookType, onViewRoom, onWaitlist, isGuestView, loadingRooms }) {
  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groupedRooms;
    return groupedRooms.filter((g) => g.roomType.toLowerCase().includes(term));
  }, [groupedRooms, search]);


  const bookedGroups = useMemo(() => {
    const availableTypes = new Set(groupedRooms.map((g) => g.roomType));
    const allTypes = new Map();
    for (const room of allRooms) {
      if (!allTypes.has(room.room_type)) allTypes.set(room.room_type, room);
    }
    return Array.from(allTypes.entries())
      .filter(([type]) => !availableTypes.has(type))
      .map(([type, room]) => ({ roomType: type, room }));
  }, [groupedRooms, allRooms]);

  return (
    <div className="rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-xl shadow-blue-950/20">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-blue-400">Rooms Available Today</h2>
          <p className="mt-1 text-sm text-slate-400">
            {isGuestView ? "Browse available room types before signing in." : "Choose a room type to book."}
          </p>
        </div>
        <input
          className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-white outline-none transition focus:border-blue-500"
          placeholder="Search by room type"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loadingRooms ? (
          [1,2,3].map((i) => <RoomCardSkeleton key={i} />)
        ) : filteredGroups.length === 0 && bookedGroups.length === 0 ? (
          <p className="col-span-full py-6 text-center text-slate-500">No room types found.</p>
        ) : (
          filteredGroups.map((group) => {
            const sampleRoom = group.rooms?.[0];
            return (
              <div key={group.roomType}
                className="group relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 transition hover:border-blue-500/60 hover:shadow-lg hover:shadow-blue-950/30">
                <div className="relative h-40 overflow-hidden">
                  <img
                    src={sampleRoom?.image_url || "https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=600"}
                    alt={group.roomType}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-800/80 to-transparent" />
                  <span className="absolute right-3 top-3 rounded-xl bg-emerald-500/90 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
                    {group.availableCount} free
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-white">{group.roomType}</h3>
                  <p className="mt-1 text-2xl font-bold text-blue-400">
                    £{group.minPrice}<span className="ml-1 text-sm font-normal text-slate-400">/ night</span>
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button type="button" onClick={() => onViewRoom(group)}
                      className="flex-1 rounded-xl border border-slate-600 bg-slate-700 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-600">Details</button>
                    <button type="button" onClick={() => onBookType(group)}
                      className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-medium text-white transition hover:bg-blue-700">Book</button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {!loadingRooms && bookedGroups.map(({ roomType, room }) => (
          <div key={roomType}
            className="relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 opacity-75">
            <div className="relative h-40 overflow-hidden">
              <img
                src={room?.image_url || "https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=600"}
                alt={roomType}
                className="h-full w-full object-cover grayscale"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-800/90 to-slate-900/40" />
              <span className="absolute right-3 top-3 rounded-xl bg-red-500/80 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
                Fully booked
              </span>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-white">{roomType}</h3>
              <p className="mt-1 text-sm text-slate-400">No rooms available today</p>
              <button type="button" onClick={() => onWaitlist(roomType)}
                className="mt-4 w-full rounded-xl border border-amber-500/40 bg-amber-950/30 py-2 text-sm font-medium text-amber-400 transition hover:bg-amber-950/50">
                Join Waitlist
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BookingSummary({ room, checkIn, checkOut, discount }) {
  const nights = nightsBetween(checkIn, checkOut);
  if (!room || !checkIn || !checkOut || nights === 0) return null;
  const subtotal = nights * Number(room.price_per_night || 0);
  const discountAmt = discount ? subtotal * (discount / 100) : 0;
  const total = subtotal - discountAmt;

  return (
    <div className="rounded-2xl border border-blue-500/30 bg-blue-950/30 p-4 text-sm space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-slate-300">{nights} night{nights !== 1 ? "s" : ""} × <span className="font-medium text-white">£{room.price_per_night}</span></span>
        <span className="text-white">£{subtotal.toFixed(2)}</span>
      </div>
      {discount > 0 && (
        <div className="flex items-center justify-between text-emerald-400">
          <span>Promo discount ({discount}%)</span>
          <span>-£{discountAmt.toFixed(2)}</span>
        </div>
      )}
      <div className="flex items-center justify-between border-t border-slate-700 pt-2 mt-2">
        <span className="font-semibold text-white">Total</span>
        <span className="text-lg font-bold text-blue-400">£{total.toFixed(2)}</span>
      </div>
      <div className="text-xs text-slate-400">{checkIn} → {checkOut}</div>
    </div>
  );
}

function WaitlistModal({ roomType, profile, onClose }) {
  const [email, setEmail] = useState(profile?.email || "");
  const [name, setName] = useState(profile?.name || "");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    const { error } = await supabase.from("waitlist").insert({
      room_type: roomType,
      email: email.trim().toLowerCase(),
      name: name.trim(),
      user_id: profile?.user_id || null,
      requested_at: new Date().toISOString(),
    });
    setLoading(false);
    if (error) { toast(error.message, "error"); return; }
    setSubmitted(true);
    toast(`You're on the waitlist for ${roomType}!`, "success");
  }

  return (
    <Modal title={`Join Waitlist — ${roomType}`} onClose={onClose}>
      {submitted ? (
        <div className="text-center space-y-4 py-4">
          <div className="text-4xl">✓</div>
          <p className="text-emerald-400 font-semibold">You're on the list!</p>
          <p className="text-sm text-slate-400">We'll notify you at <span className="text-white">{email}</span> when a {roomType} becomes available.</p>
          <button onClick={onClose} className="rounded-2xl bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700">Done</button>
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <p className="text-sm text-slate-400">All {roomType} rooms are currently booked. Leave your details and we'll contact you when one becomes available.</p>
          <input className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
            placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
            placeholder="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button className="rounded-2xl bg-amber-500 px-4 py-3 font-medium text-slate-900 transition hover:bg-amber-400 disabled:opacity-60" disabled={loading}>
            {loading ? "Joining..." : "Join Waitlist"}
          </button>
        </form>
      )}
    </Modal>
  );
}

function AnalyticsDashboard({ bookings, historyBookings, rooms }) {
  const allBookings = useMemo(() => [...bookings, ...historyBookings], [bookings, historyBookings]);

  const revenueByMonth = useMemo(() => {
    const map = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map[key] = { month: MONTH_NAMES[d.getMonth()], revenue: 0, bookings: 0 };
    }
    for (const b of allBookings) {
      if (b.cancelled || b.status === "Cancelled") continue;
      const key = b.check_in?.slice(0, 7);
      if (!map[key]) continue;
      const room = rooms.find((r) => Number(r.room_id) === Number(b.room_id));
      if (!room) continue;
      const nights = nightsBetween(b.check_in, b.check_out || b.check_in);
      map[key].revenue += nights * Number(room.price_per_night || 0);
      map[key].bookings += 1;
    }
    return Object.values(map);
  }, [allBookings, rooms]);

  const occupancyByType = useMemo(() => {
    const typeMap = {};
    for (const room of rooms) {
      if (!typeMap[room.room_type]) typeMap[room.room_type] = { type: room.room_type, totalNights: 0, bookedNights: 0 };
      typeMap[room.room_type].totalNights += 30; 
    }
    for (const b of allBookings) {
      if (b.cancelled || b.status === "Cancelled") continue;
      const room = rooms.find((r) => Number(r.room_id) === Number(b.room_id));
      if (!room) continue;
      typeMap[room.room_type].bookedNights += nightsBetween(b.check_in, b.check_out || b.check_in);
    }
    return Object.values(typeMap).map((t) => ({
      ...t,
      occupancy: t.totalNights > 0 ? Math.min(100, Math.round((t.bookedNights / t.totalNights) * 100)) : 0,
    })).sort((a, b) => b.occupancy - a.occupancy);
  }, [allBookings, rooms]);

  const heatmapData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: MONTH_NAMES[d.getMonth()] });
    }
    const grid = {}; 
    for (let d = 0; d < 7; d++) { grid[d] = {}; for (const m of months) grid[d][m.key] = 0; }
    for (const b of allBookings) {
      if (!b.check_in) continue;
      const d = new Date(b.check_in);
      const dow = (d.getDay() + 6) % 7;
      const mKey = b.check_in.slice(0, 7);
      if (grid[dow] && grid[dow][mKey] !== undefined) grid[dow][mKey]++;
    }
    return { grid, months, maxVal: Math.max(1, ...Object.values(grid).flatMap((m) => Object.values(m))) };
  }, [allBookings]);


  const stats = useMemo(() => {
    const totalRevenue = allBookings
      .filter((b) => !b.cancelled && b.status !== "Cancelled")
      .reduce((sum, b) => {
        const room = rooms.find((r) => Number(r.room_id) === Number(b.room_id));
        return sum + (room ? nightsBetween(b.check_in, b.check_out || b.check_in) * Number(room.price_per_night || 0) : 0);
      }, 0);
    const cancelled = allBookings.filter((b) => b.cancelled || b.status === "Cancelled").length;
    const avgNights = allBookings.length
      ? (allBookings.reduce((s, b) => s + nightsBetween(b.check_in, b.check_out || b.check_in), 0) / allBookings.length).toFixed(1)
      : 0;
    return { totalRevenue, cancelled, avgNights, total: allBookings.length };
  }, [allBookings, rooms]);

  function handleExportBookings() {
    const rows = allBookings.map((b) => {
      const room = rooms.find((r) => Number(r.room_id) === Number(b.room_id));
      const nights = nightsBetween(b.check_in, b.check_out || b.check_in);
      return {
        booking_id: b.booking_id || b.original_booking_id,
        room_type: room?.room_type ?? b.room_id,
        check_in: b.check_in,
        check_out: b.check_out,
        nights,
        total: room ? (nights * Number(room.price_per_night || 0)).toFixed(2) : "",
        status: b.cancelled || b.status === "Cancelled" ? "Cancelled" : b.status || "Active",
      };
    });
    exportToCSV(rows, `bookings_${todayString()}.csv`);
    toast("Bookings exported to CSV", "success");
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs">
        <p className="font-semibold text-white mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: {p.name === "Revenue" ? `£${Number(p.value).toFixed(0)}` : p.value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-blue-400">Analytics</h2>
          <p className="text-sm text-slate-400 mt-0.5">Revenue, occupancy, and booking trends</p>
        </div>
        <button onClick={handleExportBookings}
          className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700">
          <span>↓</span> Export CSV
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Revenue", value: `£${stats.totalRevenue.toLocaleString("en-GB", { minimumFractionDigits: 0 })}`, color: "text-blue-400" },
          { label: "Total Bookings", value: stats.total, color: "text-emerald-400" },
          { label: "Cancelled", value: stats.cancelled, color: "text-red-400" },
          { label: "Avg Stay", value: `${stats.avgNights} nights`, color: "text-amber-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
            <p className="text-sm text-slate-400">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="rounded-3xl border border-slate-700 bg-slate-900 p-6">
        <h3 className="font-semibold text-white mb-4">Revenue & Bookings — Last 12 Months</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={revenueByMonth} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="rev" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={(v) => `£${v}`} />
            <YAxis yAxisId="cnt" orientation="right" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }} />
            <Bar yAxisId="rev" dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[6,6,0,0]} />
            <Bar yAxisId="cnt" dataKey="bookings" name="Bookings" fill="#10b981" radius={[6,6,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Occupancy + Heatmap row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Occupancy by room type */}
        <div className="rounded-3xl border border-slate-700 bg-slate-900 p-6">
          <h3 className="font-semibold text-white mb-4">Occupancy Rate by Room Type</h3>
          <div className="space-y-3">
            {occupancyByType.length === 0 ? (
              <p className="text-sm text-slate-500">No data yet.</p>
            ) : occupancyByType.map((t) => (
              <div key={t.type}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300">{t.type}</span>
                  <span className="font-semibold text-white">{t.occupancy}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${t.occupancy}%`,
                      background: t.occupancy > 75 ? "#ef4444" : t.occupancy > 40 ? "#3b82f6" : "#10b981",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Booking heatmap */}
        <div className="rounded-3xl border border-slate-700 bg-slate-900 p-6">
          <h3 className="font-semibold text-white mb-4">Check-in Heatmap — Day × Month</h3>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr>
                  <th className="text-slate-500 font-normal pb-2 text-left w-8"></th>
                  {heatmapData.months.map((m) => (
                    <th key={m.key} className="text-slate-500 font-normal pb-2 text-center px-1">{m.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAY_NAMES.map((day, di) => (
                  <tr key={day}>
                    <td className="text-slate-500 pr-2 py-1">{day}</td>
                    {heatmapData.months.map((m) => {
                      const val = heatmapData.grid[di][m.key];
                      const intensity = val / heatmapData.maxVal;
                      return (
                        <td key={m.key} className="py-1 px-1">
                          <div
                            className="h-6 w-full rounded"
                            style={{
                              backgroundColor: val === 0
                                ? "rgb(30,41,59)"
                                : `rgba(59,130,246,${0.15 + intensity * 0.85})`,
                            }}
                            title={`${day} ${m.label}: ${val} check-in${val !== 1 ? "s" : ""}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <span>Less</span>
              {[0.1, 0.3, 0.55, 0.75, 1].map((v) => (
                <div key={v} className="h-3 w-5 rounded" style={{ backgroundColor: `rgba(59,130,246,${v})` }} />
              ))}
              <span>More</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HotelBookingWebUI() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [historyBookings, setHistoryBookings] = useState([]);
  const [guests, setGuests] = useState([]);
  const [search, setSearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState("all");
  const [authModal, setAuthModal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [guestMode, setGuestMode] = useState(false);
  const [activeTab, setActiveTab] = useState("rooms");


  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedRoomGroup, setSelectedRoomGroup] = useState(null);
  const [selectedExactRoom, setSelectedExactRoom] = useState(null);
  const [selectedRange, setSelectedRange] = useState();
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");


  const [detailsGroup, setDetailsGroup] = useState(null);
  const [detailsRoom, setDetailsRoom] = useState(null);
  const [waitlistType, setWaitlistType] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({ name: "", email: "", password: "" });
  const [bookingForm, setBookingForm] = useState({ roomType: "", roomId: "", checkIn: "", checkOut: "" });
  const [adminEmail, setAdminEmail] = useState("");

  const isOwner = !!profile?.email && profile.email.toLowerCase() === ownerEmail;
  const isAdmin = !!profile?.is_admin || isOwner;
  const isLoggedIn = !!session && !!profile;



  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => { if (mounted) setSession(data.session ?? null); });
    const { data: authListener } = supabase.auth.onAuthStateChange((_e, s) => { if (mounted) setSession(s ?? null); });
    return () => { mounted = false; authListener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { if (supabase) loadRooms(); }, []);

  useEffect(() => {
    if (!supabase) return;
    if (!session?.user) { setProfile(null); setBookings([]); setHistoryBookings([]); setGuests([]); return; }
    loadProfileAndData();
  }, [session?.user?.id]);

  async function loadRooms() {
    setLoadingRooms(true);
    const { data, error } = await supabase
      .from("rooms").select("*").eq("is_active", true)
      .order("room_type", { ascending: true }).order("price_per_night", { ascending: true });
    setLoadingRooms(false);
    if (error) { toast(error.message, "error"); return; }
    setRooms(data || []);
  }

  async function archiveExpiredBookings() {
    if (!supabase) return;
    const today = todayString();
    const { data: expiredRows, error } = await supabase.from("bookings").select("*").lt("check_out", today);
    if (error || !expiredRows?.length) return;
    const historyRows = expiredRows.map((b) => ({
      original_booking_id: b.booking_id, user_id: b.user_id, guest_id: b.guest_id,
      room_id: b.room_id, check_in: b.check_in, check_out: b.check_out,
      cancelled: Boolean(b.cancelled), status: "Completed", archived_at: new Date().toISOString(),
    }));
    await supabase.from("booking_history").upsert(historyRows, { onConflict: "original_booking_id" });
    await supabase.from("bookings").delete().in("booking_id", expiredRows.map((b) => b.booking_id));
  }

  async function loadProfileAndData() {
    if (!supabase || !session?.user) return;
    setLoading(true);
    await archiveExpiredBookings();
    const userId = session.user.id;
    const [
      { data: profileRows, error: profileError },
      { data: bookingRows, error: bookingsError },
      { data: historyRows, error: historyError },
    ] = await Promise.all([
      supabase.from("Customer Info").select("*").eq("user_id", userId).limit(1),
      supabase.from("bookings").select("*").eq("cancelled", false).order("booking_id", { ascending: false }),
      supabase.from("booking_history").select("*").order("archived_at", { ascending: false }),
    ]);
    if (profileError || bookingsError || historyError) {
      toast(profileError?.message || bookingsError?.message || historyError?.message || "Failed to load data.", "error");
      setLoading(false); return;
    }
    const currentProfile = profileRows?.[0] ?? null;
    setProfile(currentProfile);
    if (currentProfile) {
      const canSeeAll = currentProfile.is_admin || currentProfile.email?.toLowerCase() === ownerEmail;
      setBookings((bookingRows || []).filter((b) => canSeeAll || b.user_id === userId));
      setHistoryBookings((historyRows || []).filter((b) => canSeeAll || b.user_id === userId));
    } else { setBookings([]); setHistoryBookings([]); }
    if (currentProfile?.is_admin || currentProfile?.email?.toLowerCase() === ownerEmail) {
      const { data: guestRows } = await supabase
        .from("Customer Info").select("guest_id,name,email,is_admin,user_id").order("guest_id", { ascending: true });
      setGuests(guestRows || []);
    } else { setGuests([]); }
    setLoading(false);
  }



  const roomStatus = useMemo(() => {
    const map = new Map();
    const now = new Date();
    for (const room of rooms) {
      const roomBookings = bookings.filter((b) => Number(b.room_id) === Number(room.room_id));
      const usedNow = roomBookings.some((b) => new Date(b.check_in) <= now && now < new Date(b.check_out));
      const futureOrCurrent = roomBookings.filter((b) => new Date(b.check_out) > now).sort((a, b) => new Date(a.check_out) - new Date(b.check_out));
      map.set(room.room_id, { usedNow, nextFree: futureOrCurrent.length ? formatDate(futureOrCurrent[futureOrCurrent.length - 1].check_out) : "Available now" });
    }
    return map;
  }, [rooms, bookings]);

  const groupedRooms = useMemo(() => {
    const groups = new Map();
    for (const room of rooms) {
      const status = roomStatus.get(room.room_id) || { usedNow: false };
      if (status.usedNow) continue;
      const key = room.room_type;
      if (!groups.has(key)) groups.set(key, { roomType: key, minPrice: Number(room.price_per_night || 0), availableCount: 0, rooms: [] });
      const group = groups.get(key);
      group.availableCount += 1;
      group.rooms.push(room);
      group.minPrice = Math.min(group.minPrice, Number(room.price_per_night || 0));
    }
    return Array.from(groups.values()).sort((a, b) => a.minPrice - b.minPrice);
  }, [rooms, roomStatus]);

  const filteredHistoryBookings = useMemo(() => {
    const today = todayString();
    return historyBookings.filter((b) => {
      if (historyFilter === "cancelled") return b.status === "Cancelled";
      if (historyFilter === "completed") return b.status === "Completed";
      if (historyFilter === "past") return b.check_out < today;
      if (historyFilter === "upcoming") return b.check_in >= today;
      return true;
    });
  }, [historyBookings, historyFilter]);

  const unavailableDatesForRoom = useMemo(() => {
    if (!selectedExactRoom) return [];
    return bookedDatesFromRanges(bookings.filter((b) => Number(b.room_id) === Number(selectedExactRoom.room_id)));
  }, [selectedExactRoom, bookings]);

  const detailsRoomBookings = useMemo(() => {
    if (!detailsRoom) return [];
    return bookings.filter((b) => Number(b.room_id) === Number(detailsRoom.room_id));
  }, [detailsRoom, bookings]);


  async function handleSignup(e) {
    e.preventDefault(); if (!supabase) return;
    setLoading(true);
    const { name, email, password } = signupForm;
    if (!name.trim() || !email.trim() || !password.trim()) { toast("Name, email, and password are required.", "error"); setLoading(false); return; }
    if (password.length < 6) { toast("Password must be at least 6 characters.", "error"); setLoading(false); return; }
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) { toast(signUpError.message, "error"); setLoading(false); return; }
    const user = data.user;
    if (!user) { toast("Sign-up succeeded but no user was returned.", "error"); setLoading(false); return; }
    const { error: insertError } = await supabase.from("Customer Info").insert({
      user_id: user.id, name, email, is_admin: email.toLowerCase() === ownerEmail,
    });
    if (insertError) { toast(insertError.message, "error"); setLoading(false); return; }
    toast("Account created successfully!", "success");
    setSignupForm({ name: "", email: "", password: "" });
    setAuthModal(null); setLoading(false);
  }

  async function handleLogin(e) {
    e.preventDefault(); if (!supabase) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(loginForm);
    if (error) { toast(error.message?.toLowerCase().includes("invalid login credentials") ? "Incorrect email or password." : error.message, "error"); setLoading(false); return; }
    setAuthModal(null); setGuestMode(false); toast("Logged in successfully.", "success"); setLoading(false);
  }

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(null); setBookings([]); setHistoryBookings([]); setGuests([]);
    setGuestMode(false); setSelectedRoomGroup(null); setSelectedExactRoom(null); setShowBookingModal(false);
    setActiveTab("rooms");
    toast("Signed out.", "info");
  }


  async function applyPromoCode() {
    if (!supabase || !promoCode.trim()) return;
    setPromoLoading(true); setPromoError("");
    const { data, error } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("code", promoCode.trim().toUpperCase())
      .eq("is_active", true)
      .single();
    setPromoLoading(false);
    if (error || !data) { setPromoError("Invalid or expired promo code."); setPromoDiscount(0); return; }
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      setPromoError("This promo code has expired."); setPromoDiscount(0); return;
    }
    setPromoDiscount(data.discount_percent);
    toast(`Promo applied! ${data.discount_percent}% off`, "success");
  }


  function openBookingModal(group = null, room = null) {
    setSelectedRoomGroup(group);
    setSelectedExactRoom(room);
    setSelectedRange(undefined);
    setPromoCode(""); setPromoDiscount(0); setPromoError("");
    setBookingForm({ roomType: group ? group.roomType : "", roomId: room ? String(room.room_id) : "", checkIn: "", checkOut: "" });
    setShowBookingModal(true);
  }

  function chooseExactRoom(room) {
    setSelectedExactRoom(room);
    setSelectedRange(undefined);
    setBookingForm((p) => ({ ...p, roomId: String(room.room_id), checkIn: "", checkOut: "" }));
  }

  async function handleBooking(e) {
    e.preventDefault(); if (!supabase || !profile) return;
    setLoading(true);
    const today = todayString();
    if (!bookingForm.checkIn || !bookingForm.checkOut) { toast("Please select both check-in and check-out dates.", "error"); setLoading(false); return; }
    if (bookingForm.checkIn < today) { toast("Check-in date cannot be in the past.", "error"); setLoading(false); return; }
    if (bookingForm.checkOut <= bookingForm.checkIn) { toast("Check-out must be after check-in.", "error"); setLoading(false); return; }
    if (!bookingForm.roomType) { toast("Please select a room type.", "error"); setLoading(false); return; }
    const selectedRoomId = Number(bookingForm.roomId);
    const availableRoom = rooms.find((r) => Number(r.room_id) === selectedRoomId && r.room_type === bookingForm.roomType && r.is_active);
    if (!availableRoom) { toast("Please choose a room from the list.", "error"); setLoading(false); return; }
    const { data: existingBookings, error: existingError } = await supabase
      .from("bookings").select("room_id,check_in,check_out,cancelled").eq("room_id", selectedRoomId).eq("cancelled", false);
    if (existingError) { toast(existingError.message, "error"); setLoading(false); return; }
    const overlapping = (existingBookings || []).some((b) => datesOverlap(bookingForm.checkIn, bookingForm.checkOut, b.check_in, b.check_out));
    if (overlapping) { toast("That room is not available for the selected dates.", "error"); setLoading(false); return; }
    const { error } = await supabase.from("bookings").insert({
      user_id: profile.user_id, guest_id: profile.guest_id, room_id: availableRoom.room_id,
      check_in: bookingForm.checkIn, check_out: bookingForm.checkOut, cancelled: false,
      promo_code: promoCode || null, discount_percent: promoDiscount || null,
    });
    if (error) { toast(error.message, "error"); setLoading(false); return; }
    setShowBookingModal(false); setSelectedRoomGroup(null); setSelectedExactRoom(null);
    setBookingForm({ roomType: "", roomId: "", checkIn: "", checkOut: "" });
    toast(`${bookingForm.roomType} booked successfully! ✓`, "success");
    await loadProfileAndData(); setLoading(false);
  }

  async function handleCancelBooking(bookingId) {
    if (!supabase) return;
    setLoading(true);
    const { error } = await supabase.from("bookings").update({ cancelled: true }).eq("booking_id", bookingId);
    if (error) { toast(error.message, "error"); setLoading(false); return; }
    setCancelTarget(null);
    toast(`Booking #${bookingId} cancelled.`, "warning");
    await loadProfileAndData(); setLoading(false);
  }

  async function handleMakeAdmin(e) {
    e.preventDefault(); if (!supabase || !isOwner) return;
    setLoading(true);
    const { error } = await supabase.from("Customer Info").update({ is_admin: true }).eq("email", adminEmail.trim().toLowerCase());
    if (error) { toast(error.message, "error"); setLoading(false); return; }
    toast(`${adminEmail} is now an admin.`, "success"); setAdminEmail(""); await loadProfileAndData(); setLoading(false);
  }


  const TABS = isLoggedIn
    ? [
        { id: "rooms", label: "Rooms" },
        { id: "bookings", label: "My Bookings" },
        ...(isAdmin ? [{ id: "analytics", label: "Analytics" }, { id: "admin", label: "Admin" }] : []),
      ]
    : [];

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-in { animation: slideIn 0.2s ease-out; }
        .rdp-day--booked:not(.rdp-day_selected) { background-color: rgba(239,68,68,0.15)!important; color: rgb(252,165,165)!important; text-decoration: line-through; border-radius: 6px; }
        .rdp { --rdp-accent-color: #3b82f6; color: #e2e8f0; }
        .rdp-button:hover:not([disabled]):not(.rdp-day_selected) { background-color: rgba(59,130,246,0.15); }
        .rdp-day_selected { background-color: #3b82f6!important; color: white!important; }
        .rdp-day_range_middle { background-color: rgba(59,130,246,0.2)!important; color: #93c5fd!important; }
        .rdp-day_disabled { opacity: 0.3; }
        .rdp-caption_label { color: #e2e8f0; }
        .rdp-nav_button { color: #94a3b8; }
        .rdp-head_cell { color: #64748b; }
      `}</style>

      <ToastContainer />

      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-xl shadow-blue-950/20">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-blue-400">Hotel Booking System</h1>
              <p className="mt-1 text-sm text-slate-400">Book rooms online with guest, user, admin, and owner flows.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {!isLoggedIn && !guestMode && (
                <>
                  <button className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2 font-medium text-white transition hover:bg-slate-700" onClick={() => setAuthModal("login")}>Login</button>
                  <button className="rounded-2xl bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700" onClick={() => setAuthModal("signup")}>Create Account</button>
                  <button className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2 font-medium text-white transition hover:bg-slate-700" onClick={() => setGuestMode(true)}>Continue as Guest</button>
                </>
              )}
              {(isLoggedIn || guestMode) && (
                <button className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2 font-medium text-white transition hover:bg-slate-700"
                  onClick={() => { if (isLoggedIn) handleLogout(); else { setGuestMode(false); setShowBookingModal(false); } }}>
                  {isLoggedIn ? "Sign Out" : "Back"}
                </button>
              )}
            </div>
          </div>
          {isLoggedIn && (
            <p className="mt-3 text-sm text-slate-300">
              Logged in as <span className="font-semibold text-white">{profile.name}</span> ({profile.email})
              {isOwner ? " · Owner" : isAdmin ? " · Admin" : " · User"}
            </p>
          )}
          {!supabase && <p className="mt-3 text-sm text-red-400">Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.</p>}
        </div>

        {/* Welcome screen */}
        {!isLoggedIn && !guestMode && (
          <div className="mx-auto mt-16 max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-8 text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-blue-400">Welcome</h2>
            <p className="mt-3 text-sm text-slate-400">Choose how you want to continue.</p>
            <div className="mt-6 space-y-3">
              <button className="w-full rounded-2xl bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700" onClick={() => setAuthModal("login")}>Login</button>
              <button className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 font-medium text-white transition hover:bg-slate-700" onClick={() => setAuthModal("signup")}>Create Account</button>
              <button className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 font-medium text-white transition hover:bg-slate-700" onClick={() => setGuestMode(true)}>Continue as Guest</button>
            </div>
          </div>
        )}

        {/* Guest view */}
        {guestMode && !isLoggedIn && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-blue-400">Guest View</h2>
              <button className="rounded-2xl bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700" onClick={() => openBookingModal()}>Make Booking</button>
            </div>
            <RoomTypeTable
              groupedRooms={groupedRooms} allRooms={rooms} bookings={bookings}
              search={search} setSearch={setSearch}
              onBookType={openBookingModal} onViewRoom={(g) => { setDetailsGroup(g); setDetailsRoom(g.rooms?.[0] ?? null); }}
              onWaitlist={setWaitlistType} isGuestView={true} loadingRooms={loadingRooms}
            />
          </div>
        )}

        {/* Logged-in dashboard */}
        {isLoggedIn && (
          <div className="space-y-6">
            {/* Tab bar */}
            <div className="flex items-center gap-1 rounded-2xl border border-slate-700 bg-slate-900 p-1">
              {TABS.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${activeTab === tab.id ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Rooms tab */}
            {activeTab === "rooms" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-blue-400">Available Rooms</h2>
                  <button className="rounded-2xl bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700" onClick={() => openBookingModal()}>New Booking</button>
                </div>
                <RoomTypeTable
                  groupedRooms={groupedRooms} allRooms={rooms} bookings={bookings}
                  search={search} setSearch={setSearch}
                  onBookType={openBookingModal} onViewRoom={(g) => { setDetailsGroup(g); setDetailsRoom(g.rooms?.[0] ?? null); }}
                  onWaitlist={setWaitlistType} isGuestView={false} loadingRooms={loadingRooms}
                />
              </div>
            )}

            {/* Bookings tab */}
            {activeTab === "bookings" && (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Current Bookings */}
                <div className="rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
                  <h2 className="text-xl font-semibold text-blue-400">Current Bookings</h2>
                  <div className="mt-4 space-y-3">
                    {loading ? (
                      [1,2].map((i) => <Skeleton key={i} className="h-24" />)
                    ) : bookings.length === 0 ? (
                      <div className="rounded-2xl border border-slate-800 bg-slate-800 p-4 text-sm text-slate-400">No current bookings.</div>
                    ) : (
                      bookings.map((booking) => {
                        const room = rooms.find((r) => Number(r.room_id) === Number(booking.room_id));
                        const nights = nightsBetween(booking.check_in, booking.check_out);
                        const subtotal = room ? nights * Number(room.price_per_night || 0) : 0;
                        const disc = booking.discount_percent || 0;
                        const total = subtotal * (1 - disc / 100);
                        return (
                          <div key={booking.booking_id} className="rounded-2xl border border-slate-800 bg-slate-800 p-4 text-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-white">{room?.room_type ?? `Room ${booking.room_id}`}</p>
                                <p className="mt-0.5 text-slate-400">{booking.check_in} → {booking.check_out} · {nights} night{nights !== 1 ? "s" : ""}</p>
                                {disc > 0 && <p className="text-xs text-emerald-400 mt-0.5">{disc}% promo applied</p>}
                              </div>
                              <p className="font-bold text-blue-400">£{total.toFixed(2)}</p>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <span className="rounded-lg bg-emerald-900/40 px-2 py-0.5 text-xs font-medium text-emerald-400">Active</span>
                              <span className="text-xs text-slate-500">#{booking.booking_id}</span>
                            </div>
                            <button className="mt-3 rounded-2xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-white transition hover:bg-red-900"
                              onClick={() => setCancelTarget(booking)} disabled={loading}>Cancel Booking</button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* History */}
                <div className="rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-blue-400">Booking History</h2>
                      <p className="mt-1 text-sm text-slate-400">Past and cancelled bookings.</p>
                    </div>
                    <select className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-blue-500"
                      value={historyFilter} onChange={(e) => setHistoryFilter(e.target.value)}>
                      <option value="all">All</option>
                      <option value="upcoming">Upcoming</option>
                      <option value="past">Past</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="mt-4 space-y-3">
                    {filteredHistoryBookings.length === 0 ? (
                      <div className="rounded-2xl border border-slate-800 bg-slate-800 p-4 text-sm text-slate-400">No history yet.</div>
                    ) : (
                      filteredHistoryBookings.map((booking) => {
                        const room = rooms.find((r) => Number(r.room_id) === Number(booking.room_id));
                        const nights = nightsBetween(booking.check_in, booking.check_out);
                        const total = room ? nights * Number(room.price_per_night || 0) : 0;
                        const isCancelled = booking.cancelled || booking.status === "Cancelled";
                        return (
                          <div key={booking.original_booking_id} className="rounded-2xl border border-slate-800 bg-slate-800 p-4 text-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-white">{room?.room_type ?? `Room ${booking.room_id}`}</p>
                                <p className="mt-0.5 text-slate-400">{booking.check_in} → {booking.check_out} · {nights} night{nights !== 1 ? "s" : ""}</p>
                              </div>
                              <p className="font-bold text-slate-400">£{total.toFixed(2)}</p>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${isCancelled ? "bg-red-900/40 text-red-400" : "bg-slate-700 text-slate-300"}`}>
                                {isCancelled ? "Cancelled" : "Completed"}
                              </span>
                              <span className="text-xs text-slate-500">#{booking.original_booking_id}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Analytics tab */}
            {activeTab === "analytics" && isAdmin && (
              <AnalyticsDashboard bookings={bookings} historyBookings={historyBookings} rooms={rooms} />
            )}

            {/* Admin tab */}
            {activeTab === "admin" && isAdmin && (
              <div className="rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
                <h2 className="text-xl font-semibold text-blue-400 mb-4">Admin Panel</h2>
                <div className="grid gap-6 lg:grid-cols-2">
                  <div>
                    <h3 className="font-medium text-white mb-3">Guest Info</h3>
                    <div className="max-h-72 overflow-auto rounded-2xl border border-slate-800 bg-slate-800 p-4 text-sm">
                      {guests.length === 0 ? (
                        <p className="text-slate-400">No guest rows available.</p>
                      ) : (
                        <table className="min-w-full text-left text-slate-200">
                          <thead>
                            <tr className="text-slate-400">
                              <th className="pb-2 pr-4">ID</th>
                              <th className="pb-2 pr-4">Name</th>
                              <th className="pb-2 pr-4">Email</th>
                              <th className="pb-2 pr-4">Role</th>
                            </tr>
                          </thead>
                          <tbody>
                            {guests.map((guest) => {
                              const role = guest.email?.toLowerCase() === ownerEmail ? "Owner" : guest.is_admin ? "Admin" : "User";
                              return (
                                <tr key={guest.guest_id}>
                                  <td className="py-2 pr-4">{guest.guest_id}</td>
                                  <td className="py-2 pr-4">{guest.name}</td>
                                  <td className="py-2 pr-4">{guest.email}</td>
                                  <td className="py-2 pr-4">{role}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium text-white mb-3">Summary</h3>
                    <div className="grid gap-3 sm:grid-cols-3 mb-5">
                      <div className="rounded-2xl bg-slate-800 p-4"><p className="text-sm text-slate-400">Guests</p><p className="text-2xl font-bold text-blue-400">{guests.length}</p></div>
                      <div className="rounded-2xl bg-slate-800 p-4"><p className="text-sm text-slate-400">Bookings</p><p className="text-2xl font-bold text-blue-400">{bookings.length}</p></div>
                      <div className="rounded-2xl bg-slate-800 p-4"><p className="text-sm text-slate-400">History</p><p className="text-2xl font-bold text-blue-400">{historyBookings.length}</p></div>
                    </div>
                    {isOwner && (
                      <form onSubmit={handleMakeAdmin} className="space-y-3">
                        <h3 className="font-medium text-white">Promote to Admin</h3>
                        <input className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
                          placeholder="User email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
                        <button className="rounded-2xl bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60" disabled={loading}>
                          {loading ? "Saving..." : "Make Admin"}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Auth Modals ── */}
        {authModal === "login" && (
          <Modal title="Login" onClose={() => setAuthModal(null)}>
            <form className="grid gap-4" onSubmit={handleLogin}>
              <input className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500" placeholder="Email" type="email" value={loginForm.email} onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))} />
              <input className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500" placeholder="Password" type="password" value={loginForm.password} onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))} />
              <button className="rounded-2xl bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60" disabled={loading}>{loading ? "Logging in..." : "Login"}</button>
            </form>
          </Modal>
        )}

        {authModal === "signup" && (
          <Modal title="Create Account" onClose={() => setAuthModal(null)}>
            <form className="grid gap-4" onSubmit={handleSignup}>
              <input className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500" placeholder="Full name" value={signupForm.name} onChange={(e) => setSignupForm((p) => ({ ...p, name: e.target.value }))} />
              <input className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500" placeholder="Email" type="email" value={signupForm.email} onChange={(e) => setSignupForm((p) => ({ ...p, email: e.target.value }))} />
              <input className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500" placeholder="Password" type="password" value={signupForm.password} onChange={(e) => setSignupForm((p) => ({ ...p, password: e.target.value }))} />
              <button className="rounded-2xl bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60" disabled={loading}>{loading ? "Creating..." : "Create Account"}</button>
            </form>
          </Modal>
        )}

        {/* ── Room Details Modal ── */}
        {detailsGroup && detailsRoom && (
          <RoomDetailsModal
            room={detailsRoom} roomBookings={detailsRoomBookings}
            onClose={() => { setDetailsGroup(null); setDetailsRoom(null); }}
            onBook={() => openBookingModal(detailsGroup, detailsRoom)}
            isLoggedIn={isLoggedIn} isGuestView={guestMode && !isLoggedIn}
          />
        )}

        {/* ── Waitlist Modal ── */}
        {waitlistType && (
          <WaitlistModal roomType={waitlistType} profile={profile}
            onClose={() => setWaitlistType(null)} />
        )}

        {/* ── Booking Modal ── */}
        {showBookingModal && (
          <Modal
            title={guestMode && !isLoggedIn ? "Guest Booking" : selectedRoomGroup ? `Book ${selectedRoomGroup.roomType}` : "Make Booking"}
            onClose={() => { setShowBookingModal(false); setSelectedRoomGroup(null); setSelectedExactRoom(null); }}
          >
            {guestMode && !isLoggedIn ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-400">To complete a booking, please log in or create an account first.</p>
                <div className="flex gap-3">
                  <button className="rounded-2xl bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700"
                    onClick={() => { setShowBookingModal(false); setGuestMode(false); setAuthModal("login"); }}>Login</button>
                  <button className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-white transition hover:bg-slate-700"
                    onClick={() => { setShowBookingModal(false); setGuestMode(false); setAuthModal("signup"); }}>Create Account</button>
                </div>
              </div>
            ) : (
              <form className="grid gap-4" onSubmit={handleBooking}>
                {!selectedRoomGroup && (
                  <select className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
                    value={bookingForm.roomType} onChange={(e) => setBookingForm((p) => ({ ...p, roomType: e.target.value }))}>
                    <option value="">Select a room type</option>
                    {groupedRooms.map((g) => <option key={g.roomType} value={g.roomType}>{g.roomType} — from £{g.minPrice}</option>)}
                  </select>
                )}

                {selectedRoomGroup && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-800 p-4 text-sm">
                    <div className="font-semibold text-white">{selectedRoomGroup.roomType}</div>
                    <div className="mt-0.5 text-slate-400">From £{selectedRoomGroup.minPrice}/night · {selectedRoomGroup.availableCount} available</div>
                  </div>
                )}

                {selectedRoomGroup && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-blue-400">Choose your room</h3>
                    <div className="max-h-48 space-y-2 overflow-auto rounded-2xl border border-slate-800 bg-slate-950 p-3">
                      {selectedRoomGroup.rooms.map((room) => {
                        const selected = Number(bookingForm.roomId) === Number(room.room_id);
                        return (
                          <button key={room.room_id} type="button" onClick={() => chooseExactRoom(room)}
                            className={`w-full rounded-2xl border px-4 py-3 text-left transition ${selected ? "border-blue-500 bg-blue-600/20 text-white" : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"}`}>
                            <div className="font-medium">Room {room.room_number ?? room.room_id}</div>
                            <div className="text-xs text-slate-400">{room.room_type} · £{room.price_per_night}/night</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Calendar */}
                <div className="rounded-3xl border border-slate-700 bg-slate-950 p-4">
                  {selectedExactRoom && unavailableDatesForRoom.length > 0 && (
                    <div className="mb-3 flex items-center gap-2 rounded-xl bg-red-950/30 px-3 py-2 text-xs text-red-400">
                      <span>⚠</span><span>Crossed-out dates are already booked for this room.</span>
                    </div>
                  )}
                  <DayPicker mode="range" selected={selectedRange}
                    onSelect={(range) => {
                      setSelectedRange(range);
                      setBookingForm((p) => ({
                        ...p,
                        checkIn: range?.from ? range.from.toISOString().slice(0, 10) : "",
                        checkOut: range?.to ? range.to.toISOString().slice(0, 10) : "",
                      }));
                    }}
                    disabled={[{ before: new Date() }, ...(selectedExactRoom ? unavailableDatesForRoom : [])]}
                    modifiers={{ booked: selectedExactRoom ? unavailableDatesForRoom : [] }}
                    modifiersClassNames={{ booked: "rdp-day--booked" }}
                  />
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-red-500/70" />Unavailable</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-blue-500" />Your selection</span>
                  </div>
                </div>

                {/* Promo code */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Promo Code</label>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-white outline-none transition focus:border-blue-500 uppercase placeholder:normal-case placeholder:text-slate-500"
                      placeholder="Enter code"
                      value={promoCode}
                      onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoDiscount(0); setPromoError(""); }}
                    />
                    <button type="button" onClick={applyPromoCode} disabled={promoLoading || !promoCode.trim()}
                      className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50">
                      {promoLoading ? "..." : "Apply"}
                    </button>
                  </div>
                  {promoError && <p className="text-xs text-red-400">{promoError}</p>}
                  {promoDiscount > 0 && <p className="text-xs text-emerald-400">✓ {promoDiscount}% discount applied</p>}
                </div>

                {/* Live summary */}
                <BookingSummary room={selectedExactRoom} checkIn={bookingForm.checkIn} checkOut={bookingForm.checkOut} discount={promoDiscount} />

                <button
                  className="rounded-2xl bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
                  disabled={loading || !selectedExactRoom || !bookingForm.checkIn || !bookingForm.checkOut}>
                  {loading ? "Booking..." : "Confirm Booking"}
                </button>
              </form>
            )}
          </Modal>
        )}

        {/* ── Cancel Modal ── */}
        {cancelTarget && (
          <Modal title="Cancel Booking?" onClose={() => setCancelTarget(null)}>
            <div className="space-y-4">
              <p className="text-sm text-slate-300">Are you sure you want to cancel booking #{cancelTarget.booking_id}? This will move it into your booking history.</p>
              <div className="flex gap-3">
                <button className="flex-1 rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-white transition hover:bg-slate-700" onClick={() => setCancelTarget(null)} disabled={loading}>Keep Booking</button>
                <button className="flex-1 rounded-2xl bg-red-600 px-4 py-3 font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
                  onClick={() => handleCancelBooking(cancelTarget.booking_id)} disabled={loading}>
                  {loading ? "Cancelling..." : "Yes, Cancel"}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}
