import React from "react";

function Footer() {
  return (
    <footer style={styles.footer}>
      <div style={styles.container}>
        <p style={styles.text}>© {new Date().getFullYear()} CAEI-MEDICAL. Tous droits réservés.</p>
        <div style={styles.links}>
          <a href="/about" style={styles.link}>À propos</a>
          <a href="/contact" style={styles.link}>Contact</a>
          <a href="/privacy" style={styles.link}>Politique de confidentialité</a>
        </div>
      </div>
    </footer>
  );
}

const styles = {
  footer: {
    backgroundColor: "#1a1a1a", // Darker, modern background
    color: "#ffffff",
    padding: "20px 0",
    borderTop: "1px solid #333", // Subtle separation
    boxShadow: "0 -2px 10px rgba(0, 0, 0, 0.1)", // Soft shadow for depth
    flexShrink: 0, // Prevents footer from shrinking
  },
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    display: "flex",
    justifyContent: "space-between", // Spread content evenly
    alignItems: "center",
    padding: "0 20px",
    flexWrap: "wrap", // Responsive on smaller screens
  },
  text: {
    margin: 0,
    fontSize: "14px",
    opacity: 0.8, // Slightly faded for a modern look
  },
  links: {
    display: "flex",
    gap: "20px", // Consistent spacing between links
  },
  link: {
    color: "#ffffff",
    textDecoration: "none",
    fontSize: "14px",
    transition: "color 0.3s ease", // Smooth hover effect
  },
};

// Add hover effects using a separate CSS file or styled-components if preferred
const hoverStyles = `
  footer a:hover {
    color: #00aaff; // Bright accent color for hover
  }
`;

export default Footer;