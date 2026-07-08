document.addEventListener('DOMContentLoaded', () => {
  
  /* ==========================================================================
     GLOBAL / UTILITIES
     ========================================================================== */
  
  // Custom toast notification system
  const showToast = (title, message, type = 'info') => {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'toast-success' : ''}`;
    
    let icon = '<i class="fa-solid fa-circle-info" style="color: var(--color-blue)"></i>';
    if (type === 'success') {
      icon = '<i class="fa-solid fa-circle-check" style="color: var(--color-green)"></i>';
    } else if (type === 'error') {
      icon = '<i class="fa-solid fa-circle-xmark" style="color: #EA4335"></i>';
    }

    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-body">
        <h5>${title}</h5>
        <p>${message}</p>
      </div>
    `;

    container.appendChild(toast);
    
    // Trigger slide-in
    setTimeout(() => toast.classList.add('show'), 50);

    // Auto-destroy after 4s
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  };

  /* ==========================================================================
     NAVBAR & MOBILE MENU (index.html)
     ========================================================================== */
  const navbar = document.getElementById('navbar');
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');

  if (navbar) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });
  }

  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
      
      // Animate menu toggle bars
      const spans = menuToggle.querySelectorAll('span');
      if (navLinks.classList.contains('active')) {
        spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
      } else {
        spans[0].style.transform = 'none';
        spans[1].style.opacity = '1';
        spans[2].style.transform = 'none';
      }
    });

    // Close menu when a link is clicked
    const links = navLinks.querySelectorAll('a');
    links.forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        const spans = menuToggle.querySelectorAll('span');
        spans[0].style.transform = 'none';
        spans[1].style.opacity = '1';
        spans[2].style.transform = 'none';
      });
    });
  }

  /* ==========================================================================
     INTERACTIVE SYMPTOM SELECTOR (index.html)
     ========================================================================== */
  const symptomBtns = document.querySelectorAll('.symptom-btn');
  const symptomCards = document.querySelectorAll('.symptom-card');

  if (symptomBtns.length > 0 && symptomCards.length > 0) {
    symptomBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        
        // Update button states
        symptomBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update display card states
        symptomCards.forEach(card => {
          card.classList.remove('active');
          if (card.getAttribute('id') === target) {
            card.classList.add('active');
          }
        });
      });
    });
  }

  /* ==========================================================================
     TESTIMONIALS CAROUSEL (index.html)
     ========================================================================== */
  const track = document.getElementById('carouselTrack');
  const slides = Array.from(document.querySelectorAll('.testimonial-slide'));
  const nextButton = document.getElementById('carouselNext');
  const prevButton = document.getElementById('carouselPrev');
  const indicatorsContainer = document.getElementById('carouselIndicators');

  if (track && slides.length > 0) {
    let currentIndex = 0;
    let autoPlayInterval;

    const updateCarousel = (index) => {
      // Keep index within boundaries
      if (index >= slides.length) currentIndex = 0;
      else if (index < 0) currentIndex = slides.length - 1;
      else currentIndex = index;

      // Translate track
      track.style.transform = `translateX(-${currentIndex * 100}%)`;

      // Update dots
      const dots = Array.from(indicatorsContainer.querySelectorAll('.carousel-dot'));
      dots.forEach(dot => dot.classList.remove('active'));
      dots[currentIndex].classList.add('active');
    };

    // Click indicators (dots)
    if (indicatorsContainer) {
      // Clear static ones and rebuild dynamically if necessary,
      // or simply add listeners to the static dots
      const dots = Array.from(indicatorsContainer.querySelectorAll('.carousel-dot'));
      dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
          updateCarousel(index);
          resetAutoPlay();
        });
      });
    }

    // Button controls
    if (nextButton) {
      nextButton.addEventListener('click', () => {
        updateCarousel(currentIndex + 1);
        resetAutoPlay();
      });
    }

    if (prevButton) {
      prevButton.addEventListener('click', () => {
        updateCarousel(currentIndex - 1);
        resetAutoPlay();
      });
    }

    // Auto Play Logic
    const startAutoPlay = () => {
      autoPlayInterval = setInterval(() => {
        updateCarousel(currentIndex + 1);
      }, 6000);
    };

    const resetAutoPlay = () => {
      clearInterval(autoPlayInterval);
      startAutoPlay();
    };

    // Pause on Hover
    const wrapper = document.querySelector('.testimonials-carousel-wrapper');
    if (wrapper) {
      wrapper.addEventListener('mouseenter', () => clearInterval(autoPlayInterval));
      wrapper.addEventListener('mouseleave', startAutoPlay);
    }

    startAutoPlay();
  }

  /* ==========================================================================
     FAQ ACCORDION (index.html)
     ========================================================================== */
  const faqHeaders = document.querySelectorAll('.faq-header');

  if (faqHeaders.length > 0) {
    faqHeaders.forEach(header => {
      header.addEventListener('click', () => {
        const item = header.parentElement;
        const content = item.querySelector('.faq-content');
        const isActive = item.classList.contains('active');
        
        // Close all other items
        document.querySelectorAll('.faq-item').forEach(otherItem => {
          if (otherItem !== item) {
            otherItem.classList.remove('active');
            otherItem.querySelector('.faq-content').style.maxHeight = null;
          }
        });

        // Toggle state
        if (isActive) {
          item.classList.remove('active');
          content.style.maxHeight = null;
        } else {
          item.classList.add('active');
          content.style.maxHeight = content.scrollHeight + 'px';
        }
      });
    });
  }

  /* ==========================================================================
     LOGIN SCREEN (login.html)
     ========================================================================== */
  const loginForm = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const togglePasswordBtn = document.getElementById('togglePassword');
  const loginBtn = document.getElementById('loginBtn');
  
  // Toggle password visibility
  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', () => {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      
      // Update eye icon
      const icon = togglePasswordBtn.querySelector('i');
      if (type === 'text') {
        icon.className = 'fa-regular fa-eye-slash';
      } else {
        icon.className = 'fa-regular fa-eye';
      }
    });
  }

  // Simulated Login Submit
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      
      // Reset validation states
      let hasError = false;

      // Basic validations
      if (!email) {
        showToast('E-mail Obrigatório', 'Por favor, informe o seu endereço de e-mail.', 'error');
        hasError = true;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('E-mail Inválido', 'Insira um formato de e-mail válido (ex: nome@email.com).', 'error');
        hasError = true;
      }

      if (!password) {
        if (!hasError) showToast('Senha Obrigatória', 'Por favor, insira a sua senha secreta.', 'error');
        hasError = true;
      } else if (password.length < 6) {
        if (!hasError) showToast('Senha Curta', 'A senha informada deve possuir pelo menos 6 caracteres.', 'error');
        hasError = true;
      }

      if (hasError) return;

      // Loading Feedback state
      loginBtn.classList.add('btn-loading');
      loginBtn.disabled = true;

      // Mock API communication latency
      setTimeout(() => {
        loginBtn.classList.remove('btn-loading');
        loginBtn.disabled = false;
        
        // Success Mock (always succeed for demo if validation passes)
        showToast(
          'Login Realizado!', 
          `Bem-vindo de volta. Iniciando o seu painel de acompanhamento...`, 
          'success'
        );

        // Reset fields
        emailInput.value = '';
        passwordInput.value = '';
        
        // Auto redirect mock home after success
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 2500);

      }, 1800);
    });
  }

  // Fictional flows messages (Signup / Forgot Pass / Social)
  const signupLink = document.getElementById('signupLink');
  const forgotPasswordLink = document.getElementById('forgotPassword');
  const googleBtn = document.getElementById('googleBtn');
  const appleBtn = document.getElementById('appleBtn');

  if (signupLink) {
    signupLink.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('Funcionalidade de Cadastro', 'Esta é uma plataforma demonstrativa. A tela de registro está sendo preparada por nossos desenvolvedores.', 'info');
    });
  }

  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('Recuperação de Acesso', 'Um link fictício de recuperação seria enviado para o e-mail cadastrado.', 'info');
    });
  }

  if (googleBtn) {
    googleBtn.addEventListener('click', () => {
      showToast('Autenticação Externa', 'Redirecionando conexão segura com a conta Google...', 'success');
    });
  }

  if (appleBtn) {
    appleBtn.addEventListener('click', () => {
      showToast('Autenticação Externa', 'Conectando de forma criptografada com o Apple ID...', 'success');
    });
  }
});
