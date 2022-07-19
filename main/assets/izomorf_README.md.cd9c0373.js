import{_ as s,c as a,o as n,a as e}from"./app.7853f90a.js";const u=JSON.parse('{"title":"@hackbg/izomorf","description":"","frontmatter":{},"headers":[{"level":2,"title":"Setup","slug":"setup"},{"level":2,"title":"Usage","slug":"usage"}],"relativePath":"izomorf/README.md"}'),o={name:"izomorf/README.md"},l=e(`<div style="text-align:center;"><h1 id="hackbg-izomorf" tabindex="-1"><code>@hackbg/izomorf</code> <a class="header-anchor" href="#hackbg-izomorf" aria-hidden="true">#</a></h1><p>Shim for publishing isomorphic TypeScript libraries to NPM, in response to the current multilevel fragmentation of the JS packaging landscape.</p><p>Modifies package.json during publication of TypeScript packages to make TS/ESM/CJS portability more seamless.</p></div><hr><h2 id="setup" tabindex="-1">Setup <a class="header-anchor" href="#setup" aria-hidden="true">#</a></h2><ul><li><p>Requires <a href="https://pnpm.io" target="_blank" rel="noopener noreferrer">PNPM</a></p><ul><li>[ ] TODO: Make optional</li></ul></li><li><p>Add to your <code>package.json</code>:</p></li></ul><div class="language-json"><span class="copy"></span><pre><code><span class="line"><span style="color:#89DDFF;">{</span></span>
<span class="line"><span style="color:#A6ACCD;">  </span><span style="color:#89DDFF;">&quot;</span><span style="color:#C792EA;">devDependencies</span><span style="color:#89DDFF;">&quot;</span><span style="color:#89DDFF;">:</span><span style="color:#A6ACCD;"> </span><span style="color:#89DDFF;">{</span></span>
<span class="line"><span style="color:#A6ACCD;">    </span><span style="color:#89DDFF;">&quot;</span><span style="color:#FFCB6B;">@hackbg/izomorf</span><span style="color:#89DDFF;">&quot;</span><span style="color:#89DDFF;">:</span><span style="color:#A6ACCD;"> </span><span style="color:#89DDFF;">&quot;</span><span style="color:#C3E88D;">latest</span><span style="color:#89DDFF;">&quot;</span></span>
<span class="line"><span style="color:#A6ACCD;">  </span><span style="color:#89DDFF;">},</span></span>
<span class="line"><span style="color:#A6ACCD;">  </span><span style="color:#89DDFF;">&quot;</span><span style="color:#C792EA;">scripts</span><span style="color:#89DDFF;">&quot;</span><span style="color:#89DDFF;">:</span><span style="color:#A6ACCD;"> </span><span style="color:#89DDFF;">{</span></span>
<span class="line"><span style="color:#A6ACCD;">    </span><span style="color:#89DDFF;">&quot;</span><span style="color:#FFCB6B;">clean</span><span style="color:#89DDFF;">&quot;</span><span style="color:#89DDFF;">:</span><span style="color:#A6ACCD;">       </span><span style="color:#89DDFF;">&quot;</span><span style="color:#C3E88D;">izomorf clean</span><span style="color:#89DDFF;">&quot;</span><span style="color:#89DDFF;">,</span></span>
<span class="line"><span style="color:#A6ACCD;">    </span><span style="color:#89DDFF;">&quot;</span><span style="color:#FFCB6B;">release:dry</span><span style="color:#89DDFF;">&quot;</span><span style="color:#89DDFF;">:</span><span style="color:#A6ACCD;"> </span><span style="color:#89DDFF;">&quot;</span><span style="color:#C3E88D;">npm run clean &amp;&amp; izomorf dry</span><span style="color:#89DDFF;">&quot;</span><span style="color:#89DDFF;">,</span></span>
<span class="line"><span style="color:#A6ACCD;">    </span><span style="color:#89DDFF;">&quot;</span><span style="color:#FFCB6B;">release:wet</span><span style="color:#89DDFF;">&quot;</span><span style="color:#89DDFF;">:</span><span style="color:#A6ACCD;"> </span><span style="color:#89DDFF;">&quot;</span><span style="color:#C3E88D;">npm run clean &amp;&amp; izomorf wet --access=public</span><span style="color:#89DDFF;">&quot;</span></span>
<span class="line"><span style="color:#A6ACCD;">  </span><span style="color:#89DDFF;">}</span></span>
<span class="line"><span style="color:#89DDFF;">}</span></span>
<span class="line"></span></code></pre></div><h2 id="usage" tabindex="-1">Usage <a class="header-anchor" href="#usage" aria-hidden="true">#</a></h2><ul><li>Edit package</li><li>Test if your package can be released: <code>pnpm run release:dry</code></li><li>Increment version in package.json, commit</li><li>Release into the wild: <code>pnpm run release:wet</code></li></ul><p>And/or add <code>pnpm run release:dry</code> to your CI.</p>`,8),p=[l];function t(r,c,i,D,F,y){return n(),a("div",null,p)}var C=s(o,[["render",t]]);export{u as __pageData,C as default};
