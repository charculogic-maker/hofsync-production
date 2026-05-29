/******* CHARCULOGIC - WHITE LABEL CONFIGURATION *******/

const BRANDING = {
    // Name der App im Header und auf dem Home-Screen
    appName: "CharcuLogic",
    
    // Spezifischer Name des Betriebs
    betriebsName: "StevesHof Hofladen",

    // PWA / Theme (Homescreen, Statusleiste)
    primaryColor: "#28a745",
    lightBg: "#f8f9fa",
    
    // Support-Kontakt bei Problemen
    supportEmail: "support@charculogic.de",
    
    // Standard-Texte für die Produktion
    standardBereich: "Frische & Kühlung",
    
    // Aktivierte Module (falls ein Kollege z.B. keine Wurstküche hat)
    modules: {
      mhdMonitor: true,
      wareneingang: true,
      wurstkueche: true,
      haccp: true,
      orders: true
    }
  };
  
  // Macht das Branding-Objekt global verfügbar
  window.BRANDING = BRANDING;