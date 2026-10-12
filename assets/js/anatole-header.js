document.addEventListener('DOMContentLoaded', () => {
  const navbarBurgers = Array.prototype.slice.call(document.querySelectorAll('.navbar-burger'), 0);
  // 사이드바의 태그 탐색 영역 대신 상단 메뉴를 선택한다.
  const nav = document.querySelector('.header .nav');
  if (navbarBurgers.length < 1 || !nav) return;
  navbarBurgers.forEach((navbarBurger) => {
    navbarBurger.addEventListener('click', () => {
      const expanded = navbarBurger.classList.toggle('nav--active');
      nav.classList.toggle('nav--active', expanded);
      navbarBurger.setAttribute('aria-expanded', String(expanded));
    });
  });
});
