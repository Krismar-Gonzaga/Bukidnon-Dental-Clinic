import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * The Figma-built components use plain <a href> links. This turns clicks on
 * same-site links into router navigation, so pages switch without a full
 * reload (and without re-checking the session). New-tab clicks, downloads,
 * external links and in-page anchors behave normally.
 */
function LinkInterceptor() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleClick = (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = event.target.closest?.('a[href]');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.hash) return;

      event.preventDefault();
      navigate(url.pathname + url.search + url.hash);
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [navigate]);

  return null;
}

export default LinkInterceptor;
