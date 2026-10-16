import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function MarketingFooter() {
  return (
    <footer className="marketing-footer">
      <div className="footer-invitation">
        <span className="section-eyebrow">YOUR STORE. IN GOOD ORDER.</span>
        <div>
          <h2>
            A clearer view.
            <br />
            A better day at work.
          </h2>
          <Link className="marketing-cta" href="/sign-up">
            Create your workspace <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="footer-main">
        <div className="footer-brand-col">
          <Link className="brand marketing-brand" href="/">
            <span className="brand-mark">
              <span>S</span>
            </span>
            <span>
              STOCKHALE<span className="brand-dot">.</span>
            </span>
          </Link>
          <p>Good business starts with a clear view.</p>
          <span className="footer-location">
            <span className="live-dot" aria-hidden="true" /> Made for
            independent retail
          </span>
        </div>

        <nav className="footer-links" aria-label="Footer">
          <div>
            <b>Explore</b>
            <Link href="/#features">Platform</Link>
            <Link href="/how-to-use">How to use</Link>
            <Link href="/#who-its-for">Who it’s for</Link>
            <Link href="/about-us">About us</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/contact-us">Contact</Link>
          </div>
          <div>
            <b>Get started</b>
            <Link href="/sign-up">
              Create an account <ArrowUpRight size={13} aria-hidden="true" />
            </Link>
            <Link href="/sign-in">Log in</Link>
          </div>
          <div>
            <b>Legal</b>
            <Link href="/privacy-policy">Privacy policy</Link>
            <Link href="/terms-and-conditions">Terms &amp; conditions</Link>
          </div>
        </nav>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} StockHale. All rights reserved.</span>
        <a
          className="bridge-homies-credit"
          href="https://bridgehomies.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Made by <strong>Bridge Homies</strong>
          <ArrowUpRight size={13} aria-hidden="true" />
        </a>
      </div>
    </footer>
  );
}
