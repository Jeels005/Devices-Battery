 // Advanced Battery Checker - JavaScript
    (function(){
      'use strict';

      const supportsBattery = ('getBattery' in navigator);
      const levelTxt = document.getElementById('levelTxt');
      const statusTxt = document.getElementById('statusTxt');
      const healthTxt = document.getElementById('healthTxt');
      const timeTxt = document.getElementById('timeTxt');
      const chargingTxt = document.getElementById('chargingTxt');
      const voltTxt = document.getElementById('voltTxt');
      const deviceTxt = document.getElementById('deviceTxt');
      const supportTxt = document.getElementById('supportTxt');
      const progressFill = document.getElementById('progressFill');
      const svgPercent = document.getElementById('svg-percent');
      const liquidRect = document.getElementById('liquid-rect');
      const boltBox = document.getElementById('boltBox');
      const demoControls = document.getElementById('demoControls');
      const demoToggle = document.getElementById('demoToggle');
      const demoRange = document.getElementById('demoRange');
      const simDeviceSpan = document.getElementById('simDevice');
      const devicesList = document.getElementById('devicesList');
      const supportMessage = document.getElementById('supportTxt');

      let battery = null;
      let currentSim = 'phone';
      let simulated = {
        level: 0.5,
        charging: false,
        chargingTime: Infinity,
        dischargingTime: Infinity
      };

      // Show whether the API is available
      supportMessage.textContent = supportsBattery ? 'Available' : 'Not supported (using demo)';
      document.getElementById('deviceTxt').textContent = navigator.userAgent.split(')')[0] || 'Browser';

      // Helper: clamp & percent
      function pct(x){ return Math.round(x*100); }
      function clamp(v,min,max){return Math.max(min,Math.min(max,v));}

      // Format seconds as H:MM or MMm
      function formatTime(seconds){
        if(!isFinite(seconds) || seconds<0) return '--:--';
        const h = Math.floor(seconds/3600);
        const m = Math.floor((seconds%3600)/60);
        if(h>0) return `${h}h ${String(m).padStart(2,'0')}m`;
        return `${m}m`;
      }

      // Update visuals from a battery-like object {level, charging, chargingTime, dischargingTime}
      function renderFrom(b){
        const level = clamp(Number(b.level),0,1);
        const p = pct(level);
        levelTxt.textContent = p + '%';
        svgPercent.textContent = p + '%';
        progressFill.style.width = p + '%';
        // Move the liquid rect inside the svg by setting transform translateY
        // svg inner height is 168; when level=1 => translateY(0); level=0 => translateY(168)
        const height = 168 * (1 - level);
        if(liquidRect){
          liquidRect.setAttribute('transform', `translate(0, ${height})`);
        }
        // fallback div
        const liquidFallback = document.getElementById('liquidFallback');
        if(liquidFallback) liquidFallback.style.height = `${p}%`;

        // charging state
        chargingTxt.textContent = b.charging ? 'Yes' : 'No';
        statusTxt.textContent = b.charging ? 'Charging' : (p>20 ? 'Normal' : 'Low battery');

        // time
        timeTxt.textContent = b.charging ? formatTime(b.chargingTime) : formatTime(b.dischargingTime);

        // health estimate (very rough) — not provided by API, so we infer
        if(p>80) healthTxt.textContent = 'Good';
        else if(p>40) healthTxt.textContent = 'Fair';
        else healthTxt.textContent = 'Low';

        // show/hide bolt
        if(b.charging){
          boltBox.classList.add('charging');
          boltBox.style.opacity = '1';
        } else {
          boltBox.classList.remove('charging');
          boltBox.style.opacity = '0.35';
        }

        // low battery wiggly effect
        const batteryWrap = document.querySelector('.battery-wrap');
        if(p<=15 && !b.charging) batteryWrap.classList.add('lowpulse'); else batteryWrap.classList.remove('lowpulse');
      }

      // Connect to native Battery API
      function attachBatteryAPI(bat){
        battery = bat;
        supportTxt.textContent = 'Supported';
        // initial render
        renderFrom(battery);

        // listeners
        battery.addEventListener('levelchange', ()=> renderFrom(battery));
        battery.addEventListener('chargingchange', ()=> renderFrom(battery));
        battery.addEventListener('chargingtimechange', ()=> renderFrom(battery));
        battery.addEventListener('dischargingtimechange', ()=> renderFrom(battery));
      }

      // Demo/simulate mode
      function enableDemoMode(enable){
        demoControls.style.display = enable ? 'block' : 'none';
        demoControls.setAttribute('aria-hidden', (!enable).toString());
        if(enable){
          // render from simulated object
          renderFrom(simulated);
        }
      }

      // Wire demo controls
      demoToggle.addEventListener('change', (e)=>{
        const on = e.target.checked;
        if(on){
          simulated.level = demoRange.value/100;
          simulated.charging = false;
          enableDemoMode(true);
        } else {
          enableDemoMode(false);
          // attempt to reattach real API if available
          if(supportsBattery) initBattery();
        }
      });

      demoRange.addEventListener('input', (e)=>{
        simulated.level = e.target.value/100;
        // while sliding, we'll pretend discharging time changes linearly
        simulated.dischargingTime = (1 - simulated.level) * 5 * 3600; // up to 5 hours
        renderFrom(simulated);
      });

      // Device preset buttons
      devicesList.addEventListener('click', (ev)=>{
        const btn = ev.target.closest('button[data-set]');
        if(!btn) return;
        const device = btn.getAttribute('data-set');
        currentSim = device;
        simDeviceSpan.textContent = device;
        // apply some realistic presets
        if(device==='laptop'){
          demoRange.value = 72; simulated.level = 0.72; simulated.charging = true; simulated.chargingTime = 30*60; simulated.dischargingTime = Infinity;
        } else if(device==='tablet'){
          demoRange.value = 45; simulated.level = 0.45; simulated.charging = false; simulated.chargingTime = Infinity; simulated.dischargingTime = 3*3600;
        } else {
          demoRange.value = 18; simulated.level = 0.18; simulated.charging = false; simulated.chargingTime = Infinity; simulated.dischargingTime = 1.2*3600;
        }
        demoToggle.checked = true; enableDemoMode(true); renderFrom(simulated);
      });

      // Refresh button
      document.getElementById('refreshBtn').addEventListener('click', ()=>{
        if(supportsBattery) initBattery(true); else alert('Battery API not supported in this browser. Use demo mode.');
      });
      document.getElementById('demoReset').addEventListener('click', ()=>{
        demoToggle.checked = false; demoRange.value = 50; simulated.level = 0.5; enableDemoMode(false); if(supportsBattery) initBattery();
      });

      // Main: init
      async function initBattery(force=false){
        if(!supportsBattery){
          // show demo by default for unsupported
          enableDemoMode(true);
          demoToggle.checked = true;
          return;
        }
        try{
          const bat = await navigator.getBattery();
          attachBatteryAPI(bat);
          // also render periodically in case some UA doesn't fire events reliably
          if(!force){
            setInterval(()=> renderFrom(bat), 3000);
          }
        }catch(err){
          console.warn('Battery API error',err);
          enableDemoMode(true);
        }
      }

      // Kick off
      initBattery();

      // Make certain data accessible to screen readers via aria-live
      // create a hidden live region
      let live = document.getElementById('batteryLive');
      if(!live){
        live = document.createElement('div');
        live.id='batteryLive'; live.setAttribute('aria-live','polite');
        live.style.position='absolute';live.style.left='-9999px';live.style.top='auto';live.style.width='1px';live.style.height='1px';
        document.body.appendChild(live);
      }

      // Keep live text updated
      setInterval(()=>{
        live.textContent = `${levelTxt.textContent} - ${statusTxt.textContent} - ${timeTxt.textContent}`;
      }, 1500);

      // Initial visual state
      renderFrom(simulated);

      // Optional: try to request more frequent updates on mobile by adding hidden audio/event if needed — not included here for privacy

    })();
