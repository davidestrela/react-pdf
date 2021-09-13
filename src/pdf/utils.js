export const loadCDN = url => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;

    script.onload = () => {
      resolve();
    };

    script.onerror = () => {
      reject(new Error('loading cdn'));
    };

    document.head.appendChild(script);
  });
};

export const $ = element => ({
  showAll: () => element.forEach(e => $(e).show()),
  hideAll: () => element.forEach(e => $(e).hide()),
  show: () => element.classList.remove('loqr-sdk-hidden'),
  hide: () => element.classList.add('loqr-sdk-hidden'),
  toggle: () => element.classList.toggle('loqr-sdk-hidden'),
  visible: status =>
    status
      ? element.classList.remove('loqr-sdk-invisible')
      : element.classList.add('loqr-sdk-invisible'),
  html: code => (element.innerHTML = code),
  disable: () => (element.disabled = true),
  enable: () => (element.disabled = false)
});

export const isMobile = () =>
  navigator.userAgent.match(/Android/i) ||
  navigator.userAgent.match(/webOS/i) ||
  navigator.userAgent.match(/iPhone/i) ||
  navigator.userAgent.match(/iPad/i) ||
  navigator.userAgent.match(/iPod/i) ||
  navigator.userAgent.match(/BlackBerry/i) ||
  navigator.userAgent.match(/Windows Phone/i) ||
  (window.matchMedia &&
    window.matchMedia('only screen and (max-width: 760px)').matches);
