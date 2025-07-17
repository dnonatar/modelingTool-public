// toggle for HOPs

function createHopToggle(onStart, onStop) {
    const label = document.createElement("label");
    label.className = "hop-switch";
    label.style.marginLeft = "10px";
    label.style.display = "flex";
    label.style.alignItems = "center";

    const input = document.createElement("input");
    input.type = "checkbox";

    const slider = document.createElement("span");
    slider.className = "slider";

    let hopInterval = null;

    input.addEventListener("change", function () {
        if (this.checked) {
            hopInterval = setInterval(() => {
                if (typeof onStart === "function") onStart();
            }, 3000);
        } else {
            clearInterval(hopInterval);
            hopInterval = null;
            if (typeof onStop === "function") onStop();
        }
    });

    label.appendChild(input);
    label.appendChild(slider);

    // Add styles only once
    if (!document.getElementById("hop-toggle-style")) {
        const style = document.createElement("style");
        style.id = "hop-toggle-style";
        style.innerHTML = `
        .hop-switch {
          position: relative;
          display: inline-block;
          width: 28px;
          height: 16px;
        }
        .hop-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: .2s;
          border-radius: 16px;
        }
        .slider:before {
          position: absolute;
          content: "";
          height: 10px;
          width: 10px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: .2s;
          border-radius: 50%;
        }
        input:checked + .slider {
          background-color: #4CAF50;
        }
        input:checked + .slider:before {
          transform: translateX(12px);
        }
        `;
        document.head.appendChild(style);
    }

    return label;
}

// Make the function globally available
window.createHopToggle = createHopToggle;
