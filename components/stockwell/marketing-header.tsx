"use client";

import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useState } from "react";

export function MarketingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="marketing-header">
      <Link className="brand marketing-brand" href="/" aria-label="StockHale home"><span className="brand-mark"><span>S</span></span><span>STOCKHALE<span className="brand-dot">.</span></span></Link>
      <nav className="marketing-nav" aria-label="Main navigation">
        <Link href="/#features">Platform</Link><Link href="/pricing">Pricing</Link><Link href="/how-to-use">How to use</Link><Link href="/#who-its-for">Who it’s for</Link><Link href="/about-us">Our story</Link><Link href="/contact-us">Contact</Link>
      </nav>
      <div className="marketing-header-actions"><Link className="marketing-login" href="/sign-in">Log in</Link><Link className="marketing-cta small" href="/sign-up">Get started <ArrowUpRight size={15}/></Link></div>
      <button className="marketing-menu" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="marketing-mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={21}/> : <Menu size={21}/>}</button>
      {menuOpen && <nav id="marketing-mobile-navigation" className="mobile-marketing-nav" aria-label="Mobile navigation"><Link onClick={() => setMenuOpen(false)} href="/#features">Platform</Link><Link onClick={() => setMenuOpen(false)} href="/pricing">Pricing</Link><Link onClick={() => setMenuOpen(false)} href="/how-to-use">How to use</Link><Link onClick={() => setMenuOpen(false)} href="/#who-its-for">Who it’s for</Link><Link onClick={() => setMenuOpen(false)} href="/about-us">Our story</Link><Link onClick={() => setMenuOpen(false)} href="/contact-us">Contact</Link><Link onClick={() => setMenuOpen(false)} href="/sign-in">Log in</Link><Link onClick={() => setMenuOpen(false)} href="/sign-up">Get started <ArrowUpRight size={15}/></Link></nav>}
    </header>
  );
}
