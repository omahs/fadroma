import{_ as s,c as n,o as a,a as o}from"./app.7853f90a.js";const d=JSON.parse('{"title":"@hackbg/runspec ![NPM version](https://www.npmjs.com/package/@hackbg/runspec)","description":"","frontmatter":{},"headers":[{"level":2,"title":"How to use","slug":"how-to-use"}],"relativePath":"runspec/README.md"}'),p={name:"runspec/README.md"},e=o(`<h1 id="hackbg-runspec" tabindex="-1"><code>@hackbg/runspec</code> <a href="https://www.npmjs.com/package/@hackbg/runspec" target="_blank" rel="noopener noreferrer"><img src="https://img.shields.io/npm/v/@hackbg/runspec?color=9013fe&amp;label=" alt="NPM version"></a> <a class="header-anchor" href="#hackbg-runspec" aria-hidden="true">#</a></h1><p><strong>Minimal test runner and reporter.</strong></p><p>Its gimmick is that there are no gimmicks. No <code>describe</code>, no <code>expect</code>, no <code>beforeEach</code>/<code>afterAll</code>, etc. Who told you you needed those, anyway?</p><h2 id="how-to-use" tabindex="-1">How to use <a class="header-anchor" href="#how-to-use" aria-hidden="true">#</a></h2><ol><li><p>Define your <strong>test cases</strong> as plain old <strong>functions</strong> - synchronous or asynchronous, it&#39;s smart enough to handle both correctly, and you&#39;re smart enough to use JavaScript&#39;s standard control flow vocabulary.</p></li><li><p>Group test cases into <strong>specifications</strong> via regular ES modules (i.e. collect them all in an object and <code>export default</code> it.)</p></li></ol><div class="language-typescript"><span class="copy"></span><pre><code><span class="line"><span style="color:#676E95;font-style:italic;">// spec1.spec.js</span></span>
<span class="line"><span style="color:#89DDFF;font-style:italic;">export</span><span style="color:#A6ACCD;"> </span><span style="color:#89DDFF;font-style:italic;">default</span><span style="color:#A6ACCD;"> </span><span style="color:#89DDFF;">{</span></span>
<span class="line"><span style="color:#A6ACCD;">  </span><span style="color:#89DDFF;">&#39;</span><span style="color:#C3E88D;">synchronous test</span><span style="color:#89DDFF;">&#39;</span><span style="color:#A6ACCD;"> </span><span style="color:#89DDFF;">(</span><span style="color:#A6ACCD;">assert</span><span style="color:#89DDFF;">)</span><span style="color:#A6ACCD;"> </span><span style="color:#89DDFF;">{</span></span>
<span class="line"><span style="color:#F07178;">    </span><span style="color:#82AAFF;">assert</span><span style="color:#F07178;">(</span><span style="color:#FF9CAC;">true</span><span style="color:#F07178;">)</span></span>
<span class="line"><span style="color:#F07178;">  </span><span style="color:#89DDFF;">},</span></span>
<span class="line"><span style="color:#A6ACCD;">  </span><span style="color:#C792EA;">async</span><span style="color:#A6ACCD;"> </span><span style="color:#89DDFF;">&#39;</span><span style="color:#C3E88D;">asynchronous test</span><span style="color:#89DDFF;">&#39;</span><span style="color:#A6ACCD;"> </span><span style="color:#89DDFF;">(</span><span style="color:#A6ACCD;">assert</span><span style="color:#89DDFF;">)</span><span style="color:#A6ACCD;"> </span><span style="color:#89DDFF;">{</span></span>
<span class="line"><span style="color:#F07178;">    </span><span style="color:#89DDFF;font-style:italic;">await</span><span style="color:#F07178;"> </span><span style="color:#82AAFF;">someAsyncFunction</span><span style="color:#F07178;">()</span></span>
<span class="line"><span style="color:#F07178;">    </span><span style="color:#82AAFF;">assert</span><span style="color:#F07178;">(</span><span style="color:#FF9CAC;">true</span><span style="color:#F07178;">)</span></span>
<span class="line"><span style="color:#F07178;">  </span><span style="color:#89DDFF;">}</span></span>
<span class="line"><span style="color:#89DDFF;">}</span></span>
<span class="line"></span></code></pre></div><ol start="3"><li>Group specifications into a <strong>test suite</strong> in a single executable script which calls <code>runSpec</code> on the test suite to execute the specifications. By default, it looks at <code>process.argv.slice(2)</code> - if it&#39;s empty, it runs all specs. If it contains names of test suites, it runs only those.</li></ol><div class="language-typescript"><span class="copy"></span><pre><code><span class="line"><span style="color:#676E95;font-style:italic;">// index.spec.js</span></span>
<span class="line"><span style="color:#89DDFF;font-style:italic;">import</span><span style="color:#A6ACCD;"> runSpec </span><span style="color:#89DDFF;font-style:italic;">from</span><span style="color:#A6ACCD;"> </span><span style="color:#89DDFF;">&#39;</span><span style="color:#C3E88D;">@hackbg/runspec</span><span style="color:#89DDFF;">&#39;</span></span>
<span class="line"><span style="color:#89DDFF;font-style:italic;">import</span><span style="color:#A6ACCD;"> Spec1   </span><span style="color:#89DDFF;font-style:italic;">from</span><span style="color:#A6ACCD;"> </span><span style="color:#89DDFF;">&#39;</span><span style="color:#C3E88D;">./spec1.spec</span><span style="color:#89DDFF;">&#39;</span></span>
<span class="line"><span style="color:#89DDFF;font-style:italic;">import</span><span style="color:#A6ACCD;"> Spec2   </span><span style="color:#89DDFF;font-style:italic;">from</span><span style="color:#A6ACCD;"> </span><span style="color:#89DDFF;">&#39;</span><span style="color:#C3E88D;">./spec2.spec</span><span style="color:#89DDFF;">&#39;</span></span>
<span class="line"><span style="color:#89DDFF;font-style:italic;">import</span><span style="color:#A6ACCD;"> Spec3   </span><span style="color:#89DDFF;font-style:italic;">from</span><span style="color:#A6ACCD;"> </span><span style="color:#89DDFF;">&#39;</span><span style="color:#C3E88D;">./spec3.spec</span><span style="color:#89DDFF;">&#39;</span></span>
<span class="line"><span style="color:#82AAFF;">runSpec</span><span style="color:#A6ACCD;">(</span><span style="color:#89DDFF;">{</span><span style="color:#A6ACCD;"> Spec1</span><span style="color:#89DDFF;">,</span><span style="color:#A6ACCD;"> Spec2</span><span style="color:#89DDFF;">,</span><span style="color:#A6ACCD;"> Spec3 </span><span style="color:#89DDFF;">}</span><span style="color:#A6ACCD;">)</span></span>
<span class="line"></span></code></pre></div><div class="language-sh"><span class="copy"></span><pre><code><span class="line"><span style="color:#A6ACCD;">node index.spec.js</span></span>
<span class="line"><span style="color:#A6ACCD;">node index.spec.js Spec1</span></span>
<span class="line"><span style="color:#A6ACCD;">node index.spec.js Spec2 Spec3</span></span>
<span class="line"></span></code></pre></div><ol start="4"><li>Add the script to your project&#39;s <code>package.json</code> and run with <code>npm test</code>.</li></ol><div class="language-json"><span class="copy"></span><pre><code><span class="line"><span style="color:#89DDFF;">{</span></span>
<span class="line"><span style="color:#A6ACCD;">  </span><span style="color:#89DDFF;">&quot;</span><span style="color:#C792EA;">scripts</span><span style="color:#89DDFF;">&quot;</span><span style="color:#89DDFF;">:</span><span style="color:#A6ACCD;"> </span><span style="color:#89DDFF;">{</span></span>
<span class="line"><span style="color:#A6ACCD;">    </span><span style="color:#89DDFF;">&quot;</span><span style="color:#FFCB6B;">test</span><span style="color:#89DDFF;">&quot;</span><span style="color:#89DDFF;">:</span><span style="color:#A6ACCD;"> </span><span style="color:#89DDFF;">&quot;</span><span style="color:#C3E88D;">node index.spec.js</span><span style="color:#89DDFF;">&quot;</span></span>
<span class="line"><span style="color:#A6ACCD;">  </span><span style="color:#89DDFF;">}</span></span>
<span class="line"><span style="color:#89DDFF;">}</span></span>
<span class="line"></span></code></pre></div><div class="language-sh"><span class="copy"></span><pre><code><span class="line"><span style="color:#A6ACCD;">npm </span><span style="color:#82AAFF;">test</span></span>
<span class="line"><span style="color:#A6ACCD;">npm </span><span style="color:#82AAFF;">test</span><span style="color:#A6ACCD;"> Spec1</span></span>
<span class="line"><span style="color:#A6ACCD;">npm </span><span style="color:#82AAFF;">test</span><span style="color:#A6ACCD;"> Spec2 Spec3</span></span>
<span class="line"></span></code></pre></div><ul><li>Goes well with <a href="https://github.com/hackbg/ganesha" target="_blank" rel="noopener noreferrer">Ganesha</a> \u{1F609}</li></ul>`,13),l=[e];function t(c,r,i,y,D,F){return a(),n("div",null,l)}var C=s(p,[["render",t]]);export{d as __pageData,C as default};
