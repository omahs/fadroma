import{_ as s,c as a,o as e,a as o}from"./app.7853f90a.js";const A=JSON.parse('{"title":"@hackbg/dokeres","description":"","frontmatter":{},"headers":[{"level":2,"title":"Example","slug":"example"}],"relativePath":"dokeres/README.md"}'),n={name:"dokeres/README.md"},l=o(`<h1 id="hackbg-dokeres" tabindex="-1"><code>@hackbg/dokeres</code> <a class="header-anchor" href="#hackbg-dokeres" aria-hidden="true">#</a></h1><p>Wanna run something from Node in a reproducible environment? Docker&#39;s your friend, but <code>dockerode</code>&#39;s API is a little rough around the edges.</p><p>This package defines the <code>Dokeres</code>, <code>DokeresImage</code> and <code>DockeresContainer</code> classes. Use <code>DockerImage</code> to make sure a specified Docker Image exists on your system, pulling or building it if it&#39;s missing.</p><p>Request the same image to be built multiple times and it&#39;s smart enough to build it only once. This lets you e.g. launch a zillion dockerized tasks in parallel, while being sure that the same Docker image won&#39;t be pulled/built a zillion times.</p><p>Reexports <code>Docker</code> from <code>dockerode</code> for finer control.</p><h2 id="example" tabindex="-1">Example <a class="header-anchor" href="#example" aria-hidden="true">#</a></h2><div class="language-typescript"><span class="copy"></span><pre><code><span class="line"><span style="color:#89DDFF;font-style:italic;">await</span><span style="color:#A6ACCD;"> </span><span style="color:#89DDFF;">new</span><span style="color:#A6ACCD;"> </span><span style="color:#82AAFF;">Dokeres</span><span style="color:#A6ACCD;">()</span><span style="color:#89DDFF;">.</span><span style="color:#82AAFF;">image</span><span style="color:#A6ACCD;">(</span></span>
<span class="line"><span style="color:#A6ACCD;">  </span><span style="color:#89DDFF;">&#39;</span><span style="color:#C3E88D;">my-org/my-build-image:v1</span><span style="color:#89DDFF;">&#39;</span><span style="color:#89DDFF;">,</span><span style="color:#A6ACCD;"> </span><span style="color:#676E95;font-style:italic;">// tries to pull this first</span></span>
<span class="line"><span style="color:#A6ACCD;">  </span><span style="color:#89DDFF;">&#39;</span><span style="color:#C3E88D;">/path/to/my/Dockerfile</span><span style="color:#89DDFF;">&#39;</span><span style="color:#89DDFF;">,</span><span style="color:#A6ACCD;">   </span><span style="color:#676E95;font-style:italic;">// builds from this manifest if pull fails</span></span>
<span class="line"><span style="color:#A6ACCD;">)</span><span style="color:#89DDFF;">.</span><span style="color:#82AAFF;">run</span><span style="color:#A6ACCD;">(                                              </span><span style="color:#676E95;font-style:italic;">// docker run                           \\</span></span>
<span class="line"><span style="color:#A6ACCD;">  </span><span style="color:#89DDFF;">&#39;</span><span style="color:#C3E88D;">build-my-thing</span><span style="color:#89DDFF;">&#39;</span><span style="color:#89DDFF;">,</span><span style="color:#A6ACCD;"> </span><span style="color:#89DDFF;">{</span><span style="color:#A6ACCD;">                               </span><span style="color:#676E95;font-style:italic;">//   --name build-my-thing              \\</span></span>
<span class="line"><span style="color:#A6ACCD;">     </span><span style="color:#F07178;">readonly</span><span style="color:#89DDFF;">:</span><span style="color:#A6ACCD;"> </span><span style="color:#89DDFF;">{</span><span style="color:#A6ACCD;"> </span><span style="color:#89DDFF;">&#39;</span><span style="color:#F07178;">/my/project/sources</span><span style="color:#89DDFF;">&#39;</span><span style="color:#89DDFF;">:</span><span style="color:#A6ACCD;">   </span><span style="color:#89DDFF;">&#39;</span><span style="color:#C3E88D;">/src</span><span style="color:#89DDFF;">&#39;</span><span style="color:#A6ACCD;">  </span><span style="color:#89DDFF;">}</span><span style="color:#A6ACCD;"> </span><span style="color:#676E95;font-style:italic;">//   -v /my/project/sources:/sources:ro \\</span></span>
<span class="line"><span style="color:#A6ACCD;">     writable: </span><span style="color:#89DDFF;">{</span><span style="color:#A6ACCD;"> </span><span style="color:#89DDFF;">&#39;</span><span style="color:#F07178;">/my/project/artifacts</span><span style="color:#89DDFF;">&#39;</span><span style="color:#89DDFF;">:</span><span style="color:#A6ACCD;"> </span><span style="color:#89DDFF;">&#39;</span><span style="color:#C3E88D;">/dist</span><span style="color:#89DDFF;">&#39;</span><span style="color:#A6ACCD;"> </span><span style="color:#89DDFF;">}</span><span style="color:#A6ACCD;"> </span><span style="color:#676E95;font-style:italic;">//   -v /my/project/sources:/sources:rw \\</span></span>
<span class="line"><span style="color:#A6ACCD;">  </span><span style="color:#89DDFF;">}</span><span style="color:#A6ACCD;">                                                 </span><span style="color:#676E95;font-style:italic;">//   my-org/my-build-image:v1</span></span>
<span class="line"><span style="color:#A6ACCD;">)</span></span>
<span class="line"></span></code></pre></div>`,7),p=[l];function t(r,c,i,D,y,d){return e(),a("div",null,p)}var C=s(n,[["render",t]]);export{A as __pageData,C as default};
