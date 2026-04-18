(function() {
  const VERCEL_URL = 'https://jouw-app.vercel.app'

  const style = document.createElement('style')
  style.textContent = `
    #crm-chat-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      width: 56px; height: 56px; border-radius: 50%;
      background: #111; color: #fff; border: none; cursor: pointer;
      font-size: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      transition: transform 0.2s;
    }
    #crm-chat-btn:hover { transform: scale(1.08); }
    #crm-chat-frame {
      position: fixed; bottom: 92px; right: 24px; z-index: 99998;
      width: 370px; height: 520px; border-radius: 14px; border: none;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      display: none; background: #fff;
    }
    #crm-chat-frame.open { display: block; }
    @media (max-width: 480px) {
      #crm-chat-frame {
        width: calc(100vw - 20px); height: calc(100vh - 100px);
        right: 10px; bottom: 80px;
      }
    }
  `
  document.head.appendChild(style)

  const btn = document.createElement('button')
  btn.id = 'crm-chat-btn'
  btn.innerHTML = '💬'
  btn.title = 'Chat met ons'
  document.body.appendChild(btn)

  const frame = document.createElement('iframe')
  frame.id = 'crm-chat-frame'
  frame.src = VERCEL_URL + '/chat-widget'
  frame.allow = 'microphone'
  document.body.appendChild(frame)

  let open = false
  btn.addEventListener('click', () => {
    open = !open
    frame.classList.toggle('open', open)
    btn.innerHTML = open ? '✕' : '💬'
  })
})()