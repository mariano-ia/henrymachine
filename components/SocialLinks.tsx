/** Redes de Henry (@resilentos). `tone` adapta el color al fondo. */
export default function SocialLinks({ tone = "light" }: { tone?: "light" | "dark" }) {
  const cls =
    tone === "light"
      ? "text-white/65 transition-colors hover:text-white"
      : "text-ink/45 transition-colors hover:text-ink";
  return (
    <div className={"flex items-center gap-4 " + (tone === "light" ? "text-white/65" : "text-ink/45")}>
      <a href="https://www.tiktok.com/@resilentos" target="_blank" rel="noreferrer" aria-label="TikTok" className={cls}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-[19px] w-[19px]">
          <path d="M21 8.6a7.4 7.4 0 0 1-4.5-1.5v6.9a6.4 6.4 0 1 1-6.4-6.4c.3 0 .7 0 1 .1v3.3a3.2 3.2 0 1 0 2.3 3.1V2h3.1a4.5 4.5 0 0 0 .1.9A4.5 4.5 0 0 0 18.6 6a4.4 4.4 0 0 0 2.4.7z" />
        </svg>
      </a>
      <a href="https://www.youtube.com/@Resilentos" target="_blank" rel="noreferrer" aria-label="YouTube" className={cls}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-[21px] w-[21px]">
          <path d="M23 7.9a2.8 2.8 0 0 0-2-2C19.2 5.4 12 5.4 12 5.4s-7.2 0-9 .5a2.8 2.8 0 0 0-2 2A29 29 0 0 0 .6 12 29 29 0 0 0 1 16.1a2.8 2.8 0 0 0 2 2c1.8.5 9 .5 9 .5s7.2 0 9-.5a2.8 2.8 0 0 0 2-2A29 29 0 0 0 23.4 12 29 29 0 0 0 23 7.9zM9.8 14.8V9.2l6 2.8z" />
        </svg>
      </a>
      <a href="https://www.facebook.com/resilentos" target="_blank" rel="noreferrer" aria-label="Facebook" className={cls}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-[19px] w-[19px]">
          <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z" />
        </svg>
      </a>
      <a href="https://www.instagram.com/resilentos/" target="_blank" rel="noreferrer" aria-label="Instagram" className={cls}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-[19px] w-[19px]">
          <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
          <circle cx="12" cy="12" r="4.2" />
          <circle cx="17.4" cy="6.6" r="1.15" fill="currentColor" stroke="none" />
        </svg>
      </a>
    </div>
  );
}
