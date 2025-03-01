export default {
  srcExclude:  [ '*SPEC*', '*spec*', "toolbox/*" ],
  base:        process.env.VITEPRESS_BASE,
  lang:        'en-US',
  title:       'The Fadroma Guide',
  description: 'How to write Secret Network dApps with Fadroma',
  lastUpdated: true,
  themeConfig: {
    sidebar: [
      {
        text: "Welcome to Fadroma",
        collapsible: false,
        items: [
          { text: "Basic project setup",    link: "/guide/basic-project-setup" },
          { text: "Advanced project setup", link: "/guide/advanced-project-setup" },
        ]
      }, {
        text: "Rust",
        collapsible: false,
        items: [
          { text: "Prelude: Writing contracts",   link: "/guide/prelude" },
          { text: "Derive: Advanced contracts",   link: "/crates/fadroma-proc-derive/README" },
          { text: "Ensemble: Testing contracts",  link: "/crates/fadroma/ensemble/README" },
        ]
      }, {
        text: "TypeScript",
        collapsible: false,
        items: [
          { text: "Client: Talking to contracts", link: "/guide/client" },
          { text: "Ops: Launching contracts",     link: "/guide/ops" },
          { text: "Mocknet: Full-stack testing",  link: "/guide/mocknet" },
          { text: "Toolbox: General utilites",    link: "https://hackbg.github.io/toolbox/main/README.html" }
        ]
      }
    ]
  }
}
