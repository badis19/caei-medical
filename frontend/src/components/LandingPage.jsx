import React from "react";
import { Link } from "react-router-dom";

function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-blue-600 text-white py-4 px-8 flex justify-between items-center">
<h1 className="text-2xl font-bold">CAEI-MEDICAL</h1>

        <nav>
          <Link to="/login" className="mr-4">Login</Link>
          <Link to="/register" className="bg-white text-blue-600 px-4 py-2 rounded">Sign Up</Link>
        </nav>
      </header>
      
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center flex-grow text-center p-8">
        <h2 className="text-4xl font-bold text-gray-800">CAEI-MEDICAL</h2>
        <p className="text-lg text-gray-600 mt-4">The best place to manage your tasks and stay productive.</p>
        <Link to="/register" className="mt-6 bg-blue-600 text-white px-6 py-3 rounded shadow-lg">Get Started</Link>
      </section>
    </div>
  );
}

export default LandingPage;
