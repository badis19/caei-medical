import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../AuthContext.jsx";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

function Navbar() {
  const { isAuthenticated, logout, user: authUser } = useContext(AuthContext); // Get user from AuthContext
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false); // For mobile menu toggle
  const [dropdownOpen, setDropdownOpen] = useState(false); // For user dropdown
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (isAuthenticated && token) {
      // If authenticated, fetch user data
      axios
        .get("http://127.0.0.1:8000/api/user", {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((response) => {
          setUser(response.data);
        })
        .catch((err) => {
          console.error("Failed to fetch user:", err);
          localStorage.removeItem("token");
          setUser(null);
          logout(); // Ensure AuthContext reflects logout on failure
        });
    } else {
      // If not authenticated, clear user
      setUser(null);
    }
  }, [isAuthenticated, logout]); // Re-run when isAuthenticated changes

  const handleLogout = () => {
    logout();
    localStorage.removeItem("token");
    setUser(null);
    navigate("/login");
  };

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
    setDropdownOpen(false); // Close dropdown when toggling mobile menu
  };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  // Use user from state or fallback to "User"
  const displayName = user ? `${user.name} ${user.last_name}` : "User";

  return (
    <nav style={styles.navbar}>
      <div style={styles.logoContainer}>
        <Link to="/" style={styles.logo}>CAEI-MEDICAL</Link>
      </div>
      <button style={styles.menuToggle} onClick={toggleMenu}>
        {menuOpen ? "✕" : "☰"}
      </button>
      <ul style={{ ...styles.navList, ...(menuOpen ? styles.navListOpen : {}) }}>
        <li style={styles.navItem}>
          <Link to="/" style={styles.link}>Home</Link>
        </li>
        {isAuthenticated ? (
          <>
            <li style={styles.navItem}>
              <div style={styles.dropdown}>
                <span
                  onClick={toggleDropdown}
                  style={{ ...styles.username, cursor: "pointer" }}
                >
                  {displayName} ▼
                </span>
                {dropdownOpen && (
                  <div style={styles.dropdownMenu}>
                    <Link
                      to={user?.role === "superviseur" ? "/supervisor" : "/dashboard"}
                      style={styles.dropdownItem}
                      onClick={() => setDropdownOpen(false)}
                    >
                      {user?.role === "superviseur" ? "Supervisor" : "Dashboard"}
                    </Link>
                    <button
                      onClick={handleLogout}
                      style={styles.dropdownButton}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </li>
          </>
        ) : (
          <>
            <li style={styles.navItem}>
              <Link to="/login" style={styles.link}>Login</Link>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
}

const styles = {
  navbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "15px 20px",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    position: "sticky",
    top: 0,
    zIndex: 1000,
    width: "100%",
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
  },
  logoContainer: {
    flexShrink: 0,
  },
  logo: {
    fontSize: "24px",
    fontWeight: "bold",
    textDecoration: "none",
    color: "#ffffff",
    transition: "color 0.3s ease",
  },
  navList: {
    display: "flex",
    listStyle: "none",
    margin: 0,
    padding: 0,
    alignItems: "center",
    gap: "15px",
    transition: "all 0.3s ease",
  },
  navListOpen: {
    display: "flex",
    flexDirection: "column",
    position: "absolute",
    top: "60px",
    left: 0,
    right: 0,
    backgroundColor: "#1a1a1a",
    padding: "20px",
    boxShadow: "0 4px 10px rgba(0, 0, 0, 0.2)",
  },
  navItem: {
    margin: 0,
    position: "relative", // For dropdown positioning
  },
  link: {
    textDecoration: "none",
    color: "#ffffff",
    padding: "8px 16px",
    borderRadius: "5px",
    fontSize: "16px",
    transition: "backgroundColor 0.3s ease, color 0.3s ease",
  },
  username: {
    fontSize: "16px",
    opacity: 0.8,
    padding: "8px 16px",
  },
  dropdown: {
    position: "relative",
  },
  dropdownMenu: {
    position: "absolute",
    top: "100%",
    right: 0,
    backgroundColor: "#333",
    borderRadius: "5px",
    boxShadow: "0 4px 10px rgba(0, 0, 0, 0.2)",
    display: "flex",
    flexDirection: "column",
    minWidth: "150px",
    zIndex: 1001,
  },
  dropdownItem: {
    textDecoration: "none",
    color: "#ffffff",
    padding: "10px 15px",
    fontSize: "14px",
    transition: "backgroundColor 0.3s ease",
  },
  dropdownButton: {
    backgroundColor: "transparent",
    color: "#ff4d4d",
    border: "none",
    padding: "10px 15px",
    textAlign: "left",
    cursor: "pointer",
    fontSize: "14px",
    transition: "backgroundColor 0.3s ease, color 0.3s ease",
  },
  menuToggle: {
    display: "none",
    background: "none",
    border: "none",
    color: "#ffffff",
    fontSize: "24px",
    cursor: "pointer",
  },
  mobileNavList: {
    display: "none",
  },
};

// Apply responsive styles dynamically
if (window.innerWidth <= 768) {
  styles.navList.display = "none";
  styles.menuToggle.display = "block";
} else {
  styles.navList.display = "flex";
  styles.menuToggle.display = "none";
}

export default Navbar;