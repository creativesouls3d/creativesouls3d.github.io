(() => {
  const footer = document.querySelector("footer");
  if (!footer) return;

  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="site-footer-inner">
      <section class="site-footer-contact" aria-label="Store contact details">
        <a class="site-footer-brand" href="index.html">Creative Souls <strong>3D</strong></a>
        <address>Andheri West, Mumbai,<br>Maharashtra, Pin-400053</address>
        <a href="mailto:hello.creative.souls3d@gmail.com">hello.creative.souls3d@gmail.com</a>
        <p class="site-footer-instagram-prompt">Questions or custom ideas? DM us on Instagram.</p>
        <a href="https://www.instagram.com/creative.souls3d/" target="_blank" rel="noopener noreferrer" aria-label="DM Creative Souls 3D on Instagram">Instagram: @creative.souls3d</a>
      </section>
      <nav class="site-footer-policies" aria-label="Our Store Policies">
        <h2>Our Store Policies</h2>
        <a href="shipping-policy.html">Shipping Policy</a>
        <a href="return-refund-policy.html">Return Refund Policy</a>
        <a href="privacy-policy.html">Privacy Policy</a>
        <a href="terms-of-service.html">Terms of service</a>
      </nav>
    </div>
    <p class="site-footer-copyright">Creative Souls 3D &copy; ${new Date().getFullYear()} &bull; Personalized 3D Printed Art, Gifts & Keepsakes</p>
  `;
})();
