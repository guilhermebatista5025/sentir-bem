document.addEventListener('DOMContentLoaded', () => {
  
  /* ==========================================================================
     GLOBAL / UTILITIES
     ========================================================================== */

  document.querySelectorAll('a[target="_blank"]').forEach((link) => {
    link.rel = 'noopener noreferrer';
  });
  
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
     HERO TITLE GSAP ANIMATION (index.html)
     ========================================================================== */
  const heroTitle = document.querySelector('.hero-brand-title');
  if (heroTitle && typeof gsap !== 'undefined') {
    heroTitle.removeAttribute('data-aos');
    
    const word1 = heroTitle.querySelector('.word-1');
    const word2 = heroTitle.querySelector('.word-2');
    
    const splitIntoChars = (element) => {
      if (!element) return;
      const text = element.textContent.trim();
      element.innerHTML = '';
      
      [...text].forEach(char => {
        const wrapper = document.createElement('span');
        wrapper.className = 'char-wrapper';
        
        const inner = document.createElement('span');
        inner.textContent = char === ' ' ? '\u00A0' : char;
        
        wrapper.appendChild(inner);
        element.appendChild(wrapper);
      });
    };
    
    splitIntoChars(word1);
    splitIntoChars(word2);
    
    gsap.fromTo('.hero-brand-title .char-wrapper span', 
      {
        yPercent: 105,
        opacity: 0
      },
      {
        yPercent: 0,
        opacity: 1,
        duration: 1.2,
        stagger: 0.05,
        ease: 'power4.out',
        delay: 0.2
      }
    );
  }

  /* ========================================================================
     ABOUT SECTION — GSAP REVEAL & DEPTH
     ======================================================================== */
  const aboutSection = document.querySelector('.about-section');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (aboutSection && typeof gsap !== 'undefined' && !reduceMotion) {
    const aboutVisual = aboutSection.querySelector('.about-visual-content');
    const aboutTextItems = aboutSection.querySelectorAll(
      '.about-eyebrow, .about-title, .about-lead, .about-copy, .about-value'
    );
    const aboutFloatCards = aboutSection.querySelectorAll('[data-about-float]');
    const aboutOrbs = aboutSection.querySelectorAll('.about-orb');

    gsap.set(aboutVisual, { opacity: 0, x: -55, scale: 0.96 });
    gsap.set(aboutTextItems, { opacity: 0, y: 34 });
    gsap.set(aboutFloatCards, { opacity: 0, y: 22, scale: 0.92 });
    gsap.set(aboutOrbs, { opacity: 0, scale: 0.7 });

    const revealAbout = new IntersectionObserver((entries, observer) => {
      if (!entries[0].isIntersecting) return;

      const aboutTimeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
      aboutTimeline
        .to(aboutOrbs, { opacity: 1, scale: 1, duration: 1.2, stagger: 0.15 })
        .to(aboutVisual, { opacity: 1, x: 0, scale: 1, duration: 1.15 }, 0.05)
        .to(aboutTextItems, { opacity: 1, y: 0, duration: 0.85, stagger: 0.075 }, 0.18)
        .to(aboutFloatCards, { opacity: 1, y: 0, scale: 1, duration: 0.75, stagger: 0.14 }, 0.45);

      gsap.to(aboutFloatCards, {
        y: (index) => index % 2 === 0 ? -7 : 7,
        duration: 3.2,
        delay: 1.4,
        repeat: -1,
        yoyo: true,
        stagger: 0.35,
        ease: 'sine.inOut'
      });

      observer.disconnect();
    }, { threshold: 0.22 });

    revealAbout.observe(aboutSection);

    const aboutStage = aboutSection.querySelector('[data-about-parallax]');
    if (aboutStage) {
      aboutStage.addEventListener('pointermove', (event) => {
        const bounds = aboutStage.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;

        gsap.to(aboutStage.querySelector('.about-image'), {
          x: x * 9,
          y: y * 9,
          scale: 1.018,
          duration: 0.8,
          ease: 'power2.out'
        });
        gsap.to(aboutFloatCards, {
          x: x * -14,
          duration: 0.9,
          ease: 'power2.out'
        });
      });

      aboutStage.addEventListener('pointerleave', () => {
        gsap.to(aboutStage.querySelector('.about-image'), {
          x: 0,
          y: 0,
          scale: 1,
          duration: 0.9,
          ease: 'power3.out'
        });
        gsap.to(aboutFloatCards, { x: 0, duration: 0.9, ease: 'power3.out' });
      });
    }
  } else if (aboutSection && !reduceMotion) {
    aboutSection.classList.add('about-native-ready');

    const nativeAboutObserver = new IntersectionObserver((entries, observer) => {
      if (!entries[0].isIntersecting) return;
      aboutSection.classList.add('about-native-visible');
      observer.disconnect();
    }, { threshold: 0.18 });

    nativeAboutObserver.observe(aboutSection);

    const nativeStage = aboutSection.querySelector('[data-about-parallax]');
    const nativeImage = aboutSection.querySelector('.about-image');
    const nativeFloatCards = aboutSection.querySelectorAll('[data-about-float]');

    if (nativeStage && nativeImage) {
      nativeStage.addEventListener('pointermove', (event) => {
        const bounds = nativeStage.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        nativeImage.style.transform = `translate3d(${x * 9}px, ${y * 9}px, 0) scale(1.018)`;
        nativeFloatCards.forEach((card) => {
          card.style.transform = `translate3d(${x * -14}px, ${y * -8}px, 0)`;
        });
      });

      nativeStage.addEventListener('pointerleave', () => {
        nativeImage.style.transform = '';
        nativeFloatCards.forEach((card) => { card.style.transform = ''; });
      });
    }
  }

  /* ========================================================================
     PLANS SHOWCASE — AUTOMATIC 6 SECOND ROTATION
     ======================================================================== */
  const plansStage = document.querySelector('[data-plans-stage]');

  if (plansStage) {
    const planSlides = [...plansStage.querySelectorAll('[data-plan-slide]')];
    const planControls = [...plansStage.querySelectorAll('[data-plan-target]')];
    const planProgress = plansStage.querySelector('.plans-progress span');
    let activePlan = 0;
    let plansTimer;

    const resetPlansProgress = () => {
      if (!planProgress) return;
      planProgress.style.animation = 'none';
      void planProgress.offsetWidth;
      planProgress.style.animation = '';
    };

    const showPlan = (nextIndex, resetProgress = true) => {
      activePlan = (nextIndex + planSlides.length) % planSlides.length;

      planSlides.forEach((slide, index) => {
        const isActive = index === activePlan;
        slide.classList.toggle('is-active', isActive);
        slide.setAttribute('aria-hidden', String(!isActive));
      });

      planControls.forEach((control, index) => {
        const isActive = index === activePlan;
        control.classList.toggle('is-active', isActive);
        control.setAttribute('aria-selected', String(isActive));
      });

      plansStage.classList.toggle('is-professional', activePlan === 1);
      if (resetProgress) resetPlansProgress();
    };

    const startPlansTimer = () => {
      window.clearInterval(plansTimer);
      plansTimer = window.setInterval(() => showPlan(activePlan + 1), 6000);
    };

    planControls.forEach((control) => {
      control.addEventListener('click', () => {
        showPlan(Number(control.dataset.planTarget));
        startPlansTimer();
      });
    });

    plansStage.addEventListener('focusin', () => window.clearInterval(plansTimer));
    plansStage.addEventListener('focusout', startPlansTimer);

    showPlan(0, false);
    startPlansTimer();
  }

  /* ========================================================================== 
     NAVBAR & MOBILE MENU (index.html)
     ========================================================================== */
  const navbar = document.getElementById('navbar');
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');

  if (navbar) {
    const updateNavbarState = () => {
      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    };

    updateNavbarState();
    window.addEventListener('scroll', updateNavbarState);
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
  const testimonialCurrent = document.getElementById('testimonialCurrent');

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
      if (testimonialCurrent) testimonialCurrent.textContent = String(currentIndex + 1).padStart(2, '0');
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

  /* ==========================================================================
     CHATBOT INTERACTIVE SYSTEM
     ========================================================================== */
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const chatSendBtn = document.getElementById('chatSendBtn');
  const chatTypingIndicator = document.getElementById('chatTypingIndicator');
  const chatQuickReplies = document.getElementById('chatQuickReplies');
  const startChatBtn = document.getElementById('startChatBtn');

  if (chatMessages && chatInput && chatSendBtn) {
    let breathCycleInterval = null;
    let breathTimeoutId = null;

    // Helper: append message
    const appendMessage = (text, sender) => {
      const msgDiv = document.createElement('div');
      msgDiv.className = `chat-message ${sender}`;
      msgDiv.textContent = text;
      chatMessages.appendChild(msgDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      // Animate with GSAP if available
      if (typeof gsap !== 'undefined') {
        gsap.fromTo(msgDiv, 
          { opacity: 0, y: 15 },
          { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(1.2)' }
        );
      }
    };

    const appendSafeLink = (label, href, className = 'chat-emergency-link') => {
      const link = document.createElement('a');
      link.className = className;
      link.textContent = label;
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      chatMessages.appendChild(link);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    const normalizeText = (text) => text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    const isCrisisMessage = (text) => {
      const normalized = normalizeText(text);
      const crisisTerms = [
        'quero morrer', 'vou morrer', 'me matar', 'suicid', 'tirar minha vida',
        'acabar com minha vida', 'me machucar', 'me ferir', 'sem motivo para viver',
        'nao quero mais viver', 'estou em perigo', 'estao me ameacando',
        'violencia agora', 'overdose'
      ];
      return crisisTerms.some((term) => normalized.includes(term));
    };

    // Helper: show/hide typing indicator
    const showTyping = (show) => {
      if (show) {
        chatTypingIndicator.style.display = 'inline-flex';
        chatMessages.appendChild(chatTypingIndicator); // Move to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
      } else {
        chatTypingIndicator.style.display = 'none';
      }
    };

    // Helper: load quick replies
    const showQuickReplies = (replies) => {
      chatQuickReplies.innerHTML = '';
      if (!replies || replies.length === 0) return;

      replies.forEach((reply) => {
        const btn = document.createElement('button');
        btn.className = 'quick-reply-btn';
        btn.textContent = reply.text;
        btn.addEventListener('click', () => {
          // Clear replies immediately
          chatQuickReplies.innerHTML = '';
          // Send user message
          appendMessage(reply.text, 'user');
          // Handle response
          setTimeout(() => {
            handleAction(reply.action, reply.text);
          }, 600);
        });
        chatQuickReplies.appendChild(btn);

        if (typeof gsap !== 'undefined') {
          gsap.fromTo(btn,
            { opacity: 0, y: 10 },
            { opacity: 1, y: 0, duration: 0.3, delay: 0.1, ease: 'power2.out' }
          );
        }
      });
    };

    // Clear breath timer
    const clearBreathExercise = () => {
      if (breathCycleInterval) clearInterval(breathCycleInterval);
      if (breathTimeoutId) clearTimeout(breathTimeoutId);
      breathCycleInterval = null;
      breathTimeoutId = null;
    };

    // Breath exercise logic
    const renderBreathExercise = () => {
      clearBreathExercise();
      const exerciseDiv = document.createElement('div');
      exerciseDiv.className = 'breath-bubble';
      exerciseDiv.innerHTML = `
        <div class="breath-instruction" id="breathInstruction">Clique abaixo para iniciar</div>
        <div class="breath-circle" id="breathCircle">🧘</div>
        <button class="breath-btn" id="breathControlBtn">Começar 4-7-8</button>
      `;
      chatMessages.appendChild(exerciseDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      const instruction = exerciseDiv.querySelector('#breathInstruction');
      const circle = exerciseDiv.querySelector('#breathCircle');
      const btn = exerciseDiv.querySelector('#breathControlBtn');

      let cycle = 0;

      const runCycle = () => {
        if (cycle >= 3) {
          clearBreathExercise();
          instruction.textContent = "Exercício concluído.";
          circle.textContent = "✨";
          circle.style.transform = "scale(1)";
          circle.style.backgroundColor = "rgba(46, 196, 182, 0.15)";
          circle.style.borderColor = "#2ec4b6";
          btn.style.display = 'none';

          setTimeout(() => {
            showTyping(true);
            setTimeout(() => {
              showTyping(false);
              appendMessage("Muito bem. Esse ciclo ajuda a restabelecer o equilíbrio físico. Como você está se sentindo agora?", 'bot');
              showQuickReplies([
                { text: "Estou mais calmo(a) 😊", action: 'breath_better' },
                { text: "Ainda sinto ansiedade 😟", action: 'breath_still_anxious' },
                { text: "Falar com psicólogo 💬", action: 'talk_to_therapist' },
                { text: "Voltar ao menu inicial 🏠", action: 'start' }
              ]);
            }, 1000);
          }, 1500);
          return;
        }

        // Inspire: 4s
        instruction.textContent = "Inspire pelo nariz...";
        circle.textContent = "Inspire";
        circle.style.transform = "scale(1.4)";
        circle.style.transition = "transform 4s cubic-bezier(0.4, 0, 0.2, 1)";
        
        breathTimeoutId = setTimeout(() => {
          // Segure: 7s
          instruction.textContent = "Segure o ar...";
          circle.textContent = "Segure";
          circle.style.transition = "none";
          
          breathTimeoutId = setTimeout(() => {
            // Expire: 8s
            instruction.textContent = "Expire lentamente pela boca...";
            circle.textContent = "Expire";
            circle.style.transform = "scale(1)";
            circle.style.transition = "transform 8s cubic-bezier(0.4, 0, 0.2, 1)";
            
            breathTimeoutId = setTimeout(() => {
              cycle++;
              runCycle();
            }, 8000);
          }, 7000);
        }, 4000);
      };

      btn.addEventListener('click', () => {
        btn.disabled = true;
        btn.textContent = "Exercitando...";
        cycle = 0;
        runCycle();
      });
    };

    // Conversational Actions router
    const handleAction = (action, userText) => {
      clearBreathExercise();
      showTyping(true);

      setTimeout(() => {
        showTyping(false);

        switch (action) {
          case 'start':
            appendMessage("Olá! Sou o Assistente Sentir Bem. 💙\nOfereço acolhimento inicial e orientações gerais, mas não substituo psicoterapia, diagnóstico ou atendimento de emergência. Esta conversa não é armazenada.\n\nComo você está se sentindo hoje?", 'bot');
            showQuickReplies([
              { text: "🧘 Lidar com ansiedade", action: 'anxiety' },
              { text: "😴 Não consigo dormir (insônia)", action: 'insomnia' },
              { text: "💼 Estresse no trabalho", action: 'work_stress' },
              { text: "📅 Quero agendar uma sessão", action: 'talk_to_therapist' }
            ]);
            break;

          case 'anxiety':
            appendMessage("Entendo. A ansiedade pode acelerar nossos batimentos e pensamentos. Na TCC, um dos primeiros passos é trazer o corpo de volta ao presente.\n\nPodemos fazer um breve exercício guiado de respiração (técnica 4-7-8) ou ver dicas práticas de aterramento. O que prefere?", 'bot');
            showQuickReplies([
              { text: "Fazer respiração guiada 🧘", action: 'breath_exercise' },
              { text: "Ver dicas práticas de ansiedade 💡", action: 'anxiety_tips' },
              { text: "Voltar ao menu inicial 🏠", action: 'start' }
            ]);
            break;

          case 'breath_exercise':
            appendMessage("Encontre uma posição confortável e relaxe os ombros. Vamos respirar juntos 3 vezes. Pare o exercício se sentir tontura, falta de ar ou desconforto.", 'bot');
            setTimeout(() => {
              renderBreathExercise();
            }, 500);
            break;

          case 'anxiety_tips':
            appendMessage("Aqui estão 3 técnicas rápidas de TCC para momentos de ansiedade:\n\n1. **A técnica 5-4-3-2-1**: Identifique à sua volta 5 coisas que você vê, 4 que pode tocar, 3 que ouve, 2 que pode cheirar e 1 que pode provar. Isso ancora sua mente no presente.\n\n2. **Desafie pensamentos catastróficos**: Pergunte-se: 'O que estou pensando é um fato real ou apenas uma hipótese da minha mente?'\n\n3. **Foque no agora**: Se não há nada que possa ser feito sobre o problema neste exato minuto, traga sua atenção para uma tarefa manual simples.", 'bot');
            showQuickReplies([
              { text: "Experimentar Respiração Guiada 🧘", action: 'breath_exercise' },
              { text: "Falar com psicólogo no WhatsApp 💬", action: 'talk_to_therapist' },
              { text: "Voltar ao menu inicial 🏠", action: 'start' }
            ]);
            break;

          case 'breath_better':
            appendMessage("Que bom que houve algum alívio. Você pode repetir o exercício quando ele for confortável para você. Se a ansiedade persistir ou interferir na rotina, vale conversar diretamente com o Psicólogo Messias.", 'bot');
            showQuickReplies([
              { text: "Falar com o Psicólogo Messias 💬", action: 'talk_to_therapist' },
              { text: "Voltar ao menu inicial 🏠", action: 'start' }
            ]);
            break;

          case 'breath_still_anxious':
            appendMessage("É normal que leve algum tempo para o corpo relaxar por completo. Não se cobre. Além dos exercícios, a psicoterapia clínica ajuda a tratar a raiz da ansiedade. Que tal dar o primeiro passo e agendar uma sessão?", 'bot');
            showQuickReplies([
              { text: "Agendar sessão pelo WhatsApp 💬", action: 'talk_to_therapist' },
              { text: "Voltar ao menu inicial 🏠", action: 'start' }
            ]);
            break;

          case 'insomnia':
            appendMessage("Dificuldades para dormir podem gerar bastante desgaste no dia seguinte. A higiene do sono reúne estratégias gerais que podem ajudar a criar uma rotina mais favorável ao descanso. Quer ver algumas dicas práticas?", 'bot');
            showQuickReplies([
              { text: "Sim, enviar dicas do sono 😴", action: 'insomnia_tips' },
              { text: "Falar com o psicólogo 💬", action: 'talk_to_therapist' },
              { text: "Voltar ao menu inicial 🏠", action: 'start' }
            ]);
            break;

          case 'insomnia_tips':
            appendMessage("Dicas essenciais de Higiene do Sono baseadas em TCC:\n\n1. **A regra dos 20 minutos**: Se deitar e não dormir em 20 minutos, levante-se da cama. Vá para outro cômodo, faça uma leitura calma à luz fraca e só volte quando tiver sono. A cama deve ser associada apenas ao sono.\n\n2. **Sem telas na cama**: Evite celular ou TV na cama. A luz azul confunde seu cérebro de que ainda é dia.\n\n3. **Ambiente seguro**: Mantenha o quarto escuro, fresco e silencioso.", 'bot');
            showQuickReplies([
              { text: "Falar com o Psicólogo Messias 💬", action: 'talk_to_therapist' },
              { text: "Voltar ao menu inicial 🏠", action: 'start' }
            ]);
            break;

          case 'work_stress':
            appendMessage("O estresse crônico consome nossa saúde física e mental. A TCC ajuda na reestruturação cognitiva e na definição de limites assertivos.\n\nO que mais tem pesado no seu estresse profissional?", 'bot');
            showQuickReplies([
              { text: "Sobrecarga e prazos 💼", action: 'stress_overload' },
              { text: "Preocupações com o futuro/carreira 📈", action: 'stress_future' },
              { text: "Voltar ao menu inicial 🏠", action: 'start' }
            ]);
            break;

          case 'stress_overload':
            appendMessage("Lidar com sobrecarga exige organização e limites:\n\n1. **A Matriz de Prioridades**: Classifique suas demandas em Importantes/Urgentes, Importantes/Não Urgentes, Não Importantes/Urgentes e Não Importantes/Não Urgentes. Resolva o primeiro grupo, agende o segundo, delegue o terceiro e descarte o quarto.\n\n2. **Técnica Pomodoro**: Trabalhe focado por 25 minutos e descanse 5. A cada 4 ciclos, faça uma pausa maior. Isso evita a estafa mental.\n\n3. **Comunicação assertiva**: Se necessário, converse com sua gestão demonstrando sua capacidade de entrega baseada em dados, e negocie prioridades.", 'bot');
            showQuickReplies([
              { text: "Falar com psicólogo 💬", action: 'talk_to_therapist' },
              { text: "Voltar ao menu inicial 🏠", action: 'start' }
            ]);
            break;

          case 'stress_future':
            appendMessage("Para conter a mente ansiosa que vive no futuro, experimente o **Tempo de Preocupação**:\n\nSepare 15 minutos do seu dia (evite a noite) para sentar e escrever todas as suas preocupações de carreira e possíveis ações práticas. Caso uma preocupação surja em outro horário, anote-a rapidamente e diga a si mesmo: 'Vou pensar nisso no meu momento de preocupação'. Isso ajuda a diminuir o fluxo mental excessivo.", 'bot');
            showQuickReplies([
              { text: "Falar com psicólogo 💬", action: 'talk_to_therapist' },
              { text: "Voltar ao menu inicial 🏠", action: 'start' }
            ]);
            break;

          case 'talk_to_therapist':
            const customText = "Olá, Psicólogo Messias! Acessei o site Sentir Bem e gostaria de receber informações para agendar uma consulta.";
            const encodedText = encodeURIComponent(customText);
            appendMessage(`Excelente decisão! Cuidar da mente é o primeiro passo para uma vida mais leve. 🩺\n\nClique no botão abaixo para iniciar sua conversa de agendamento diretamente no WhatsApp com o Psicólogo Messias Sousa.`, 'bot');
            
            const linkBtn = document.createElement('a');
            linkBtn.href = `https://wa.me/5521975891580?text=${encodedText}`;
            linkBtn.target = "_blank";
            linkBtn.rel = "noopener noreferrer";
            linkBtn.className = "btn btn-primary chatbot-btn";
            linkBtn.style.margin = "10px 16px";
            linkBtn.style.display = "inline-flex";
            linkBtn.style.alignItems = "center";
            linkBtn.style.justifyContent = "center";
            linkBtn.style.gap = "8px";
            linkBtn.style.fontSize = "0.85rem";
            linkBtn.style.padding = "10px 20px";
            linkBtn.style.borderRadius = "20px";
            linkBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Iniciar Agendamento';
            
            chatMessages.appendChild(linkBtn);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            showQuickReplies([
              { text: "Voltar ao menu inicial 🏠", action: 'start' }
            ]);
            break;

          case 'crisis_support':
            appendMessage("Sinto muito que você esteja passando por isso. Sua segurança vem primeiro. Se existe risco imediato ou você já se machucou, ligue agora para o SAMU 192 ou vá ao pronto atendimento mais próximo. Para apoio emocional, o CVV atende gratuitamente pelo 188, 24 horas. Se puder, fique perto de alguém de confiança e afaste objetos ou substâncias que possam causar ferimentos.", 'bot');
            appendSafeLink('Ligar para o SAMU — 192', 'tel:192');
            appendSafeLink('Ligar para o CVV — 188', 'tel:188');
            showQuickReplies([
              { text: "Falar com o psicólogo para agendamento", action: 'talk_to_therapist' },
              { text: "Voltar ao menu inicial", action: 'start' }
            ]);
            break;

          default:
            appendMessage("Desculpe, não entendi muito bem. Mas você pode escolher uma das opções abaixo para eu te ajudar:", 'bot');
            showQuickReplies([
              { text: "🧘 Lidar com ansiedade", action: 'anxiety' },
              { text: "😴 Não consigo dormir (insônia)", action: 'insomnia' },
              { text: "💼 Estresse no trabalho", action: 'work_stress' },
              { text: "📅 Quero agendar uma sessão", action: 'talk_to_therapist' }
            ]);
        }
      }, 1000);
    };

    // Free text intent processing
    const processFreeTextInput = (text) => {
      const safeText = text.slice(0, 600);
      const lower = normalizeText(safeText);
      
      appendMessage(safeText, 'user');
      chatInput.value = '';
      clearBreathExercise();

      if (isCrisisMessage(safeText)) {
        handleAction('crisis_support');
        return;
      }
      
      showTyping(true);

      setTimeout(() => {
        showTyping(false);

        if (lower.includes('ansied') || lower.includes('ansios') || lower.includes('panico') || lower.includes('nervos') || lower.includes('acelerad')) {
          appendMessage("Percebi que você mencionou sintomas de ansiedade ou agitação. A TCC tem ótimas ferramentas para isso.", 'bot');
          showQuickReplies([
            { text: "Fazer respiração guiada 🧘", action: 'breath_exercise' },
            { text: "Ver dicas práticas de ansiedade 💡", action: 'anxiety_tips' },
            { text: "Falar com psicólogo 💬", action: 'talk_to_therapist' }
          ]);
        } else if (lower.includes('dormir') || lower.includes('sono') || lower.includes('insonia') || lower.includes('noite') || lower.includes('cama')) {
          appendMessage("Mencionou problemas com sono. Dormir bem é fundamental para nossa regulação emocional. Veja o que sugere a Higiene do Sono na TCC:", 'bot');
          showQuickReplies([
            { text: "Sim, ver dicas do sono 😴", action: 'insomnia_tips' },
            { text: "Falar com psicólogo 💬", action: 'talk_to_therapist' }
          ]);
        } else if (lower.includes('trabalh') || lower.includes('estress') || lower.includes('chefe') || lower.includes('cargo') || lower.includes('tarefa') || lower.includes('urgente')) {
          appendMessage("Parece que o estresse do trabalho ou sobrecarga está incomodando. Vamos ver dicas de gerenciamento e limites baseadas na TCC?", 'bot');
          showQuickReplies([
            { text: "Sim, ver dicas de estresse 💼", action: 'stress_overload' },
            { text: "Falar com psicólogo 💬", action: 'talk_to_therapist' }
          ]);
        } else if (lower.includes('consult') || lower.includes('agend') || lower.includes('sessa') || lower.includes('psicolog') || lower.includes('messias') || lower.includes('valor') || lower.includes('preco')) {
          appendMessage("Você gostaria de saber sobre consultas e agendamentos. Posso te direcionar diretamente para o WhatsApp do psicólogo.", 'bot');
          showQuickReplies([
            { text: "Falar com psicólogo no WhatsApp 💬", action: 'talk_to_therapist' },
            { text: "Voltar ao menu inicial 🏠", action: 'start' }
          ]);
        } else {
          appendMessage("Obrigado por compartilhar isso comigo. Acolher seus sentimentos é muito importante. Gostaria de explorar algum dos nossos temas de apoio ou falar com o Psicólogo Messias?", 'bot');
          showQuickReplies([
            { text: "🧘 Lidar com ansiedade", action: 'anxiety' },
            { text: "😴 Não consigo dormir (insônia)", action: 'insomnia' },
            { text: "💼 Estresse no trabalho", action: 'work_stress' },
            { text: "📅 Falar com o psicólogo", action: 'talk_to_therapist' }
          ]);
        }
      }, 1200);
    };

    // Event listeners
    chatSendBtn.addEventListener('click', () => {
      const text = chatInput.value.trim();
      if (text) {
        processFreeTextInput(text);
      }
    });

    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const text = chatInput.value.trim();
        if (text) {
          processFreeTextInput(text);
        }
      }
    });

    // Start Chat Button scrolling and focusing
    if (startChatBtn) {
      startChatBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetElement = document.querySelector('.phone-container');
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => {
            targetElement.style.borderColor = 'var(--color-primary)';
            targetElement.style.boxShadow = '0 25px 50px -12px rgba(120, 148, 169, 0.6), 0 0 0 4px var(--color-primary)';
            setTimeout(() => {
              targetElement.style.borderColor = '#28292b';
              targetElement.style.boxShadow = '0 25px 50px -12px rgba(6, 6, 7, 0.4), 0 0 0 2px rgba(255, 255, 255, 0.05)';
              chatInput.focus();
            }, 1000);
          }, 800);
        }
      });
    }

    // Lazy initialization when section enters viewport
    const initChatbot = () => {
      chatMessages.innerHTML = '';
      showTyping(true);
      setTimeout(() => {
        showTyping(false);
        appendMessage("Olá! Sou o Assistente Sentir Bem. 💙\nOfereço acolhimento inicial e orientações gerais, mas não substituo psicoterapia, diagnóstico ou atendimento de emergência. Esta conversa não é armazenada.\n\nComo você está se sentindo hoje?", 'bot');
        showQuickReplies([
          { text: "🧘 Lidar com ansiedade", action: 'anxiety' },
          { text: "😴 Não consigo dormir (insônia)", action: 'insomnia' },
          { text: "💼 Estresse no trabalho", action: 'work_stress' },
          { text: "📅 Quero agendar uma sessão", action: 'talk_to_therapist' }
        ]);
      }, 1000);
    };

    // Use IntersectionObserver to start conversation when user scrolls to it
    const chatbotSection = document.getElementById('acolhimento-24h');
    if (chatbotSection) {
      const observer = new IntersectionObserver((entries, obs) => {
        if (entries[0].isIntersecting) {
          initChatbot();
          obs.disconnect();
        }
      }, { threshold: 0.3 });
      observer.observe(chatbotSection);
    } else {
      initChatbot();
    }
  }
});
