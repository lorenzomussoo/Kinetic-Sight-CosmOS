let isPinchingGlobally = false;
let isAppReady = false;

let targetTimeScale = 1.0;
let currentTimeScale = 1.0;

let handHistory = [];
let scrollVelocity = 0;

const gazeCoordinates = new THREE.Vector2(-2, -2);
let hoveredGroup = null;
let grabbedPlanetGroup = null;
let prevHovered = null;
let isDetailMode = false;
let detailPlanetTarget = null;

let testActive = false;
let currentTaskName = "";
let testStartTime = 0;
let missedPinches = 0;
let voiceErrors = 0;
let totalGrabs = 0;
let wasPinching = false;

const uiTarget = document.getElementById('status_target');
const uiGaze = document.getElementById('status_gaze');
const uiHand = document.getElementById('status_hand');
const uiTranscript = document.getElementById('live_transcript');
const infoPanel = document.getElementById('info_panel');
const uiDashboard = document.getElementById('ui_dashboard');
const detailPanel = document.getElementById('detail_panel');

const toggleCmds = document.getElementById('toggle_cmds');
const cmdList = document.getElementById('cmd_list');
if (toggleCmds && cmdList) {
    toggleCmds.addEventListener('click', () => {
        if (cmdList.style.display === 'none') {
            cmdList.style.display = 'block';
            toggleCmds.innerText = 'Hide Commands ▲';
            toggleCmds.style.background = 'rgba(0, 210, 255, 0.2)';
        } else {
            cmdList.style.display = 'none';
            toggleCmds.innerText = 'Show Commands ▼';
            toggleCmds.style.background = 'rgba(0, 210, 255, 0.1)';
        }
    });
}

const loadingManager = new THREE.LoadingManager();
const loadStatusText = document.getElementById('loading_status');

loadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
    const progress = Math.round((itemsLoaded / itemsTotal) * 100);
    if (loadStatusText) loadStatusText.innerText = `📡 Loading Local Textures: ${progress}%`;
};

loadingManager.onLoad = function () {
    if (loadStatusText) {
        loadStatusText.innerText = `✅ Models Loaded Successfully!`;
        loadStatusText.style.color = "#00ff88";
    }
};

loadingManager.onError = function (url) {
    console.error("Missing texture:", url);
    if (loadStatusText) {
        loadStatusText.innerText = `⚠️ Some files missing. Check names.`;
        loadStatusText.style.color = "#ff3366";
    }
};

const texLoader = new THREE.TextureLoader(loadingManager);

function createSoftGlowTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255, 230, 100, 1)'); grad.addColorStop(0.3, 'rgba(255, 120, 0, 0.8)');
    grad.addColorStop(0.6, 'rgba(255, 40, 0, 0.3)'); grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(canvas);
}

const scene = new THREE.Scene();
const camera3D = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setPixelRatio(window.devicePixelRatio); renderer.setSize(window.innerWidth, window.innerHeight);

if (THREE.SRGBColorSpace) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
} else {
    renderer.outputEncoding = 3000;
}

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas3d').appendChild(renderer.domElement);

const defaultCameraPos = new THREE.Vector3(0, 35, 75);
const defaultLookAt = new THREE.Vector3(0, 0, 0);
camera3D.position.copy(defaultCameraPos);
let currentLookTarget = new THREE.Vector3(0, 0, 0);

scene.add(new THREE.AmbientLight(0x222233));
const sunLight = new THREE.PointLight(0xffffff, 4, 400);
sunLight.castShadow = true; sunLight.shadow.mapSize.width = 2048; sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.bias = -0.001; scene.add(sunLight);

const planetsList = [];
let sunVisualMesh = null;

function createPlanet(config) {
    const group = new THREE.Group();
    group.userData = { ...config, angle: Math.random() * Math.PI * 2, theoreticalAngle: 0 };
    group.userData.theoreticalAngle = group.userData.angle;

    const geo = new THREE.SphereGeometry(config.radius, 64, 64);
    let visualMesh;

    let baseEmissive = 0x000000;
    let baseEmissiveIntensity = 0;
    let loadedMap = null;

    if (config.isSun) {
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        visualMesh = new THREE.Mesh(geo, sunMat);
        if (config.tex) {
            texLoader.load(config.tex, (texture) => {
                if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace; else texture.encoding = 3000;
                sunMat.map = texture; sunMat.needsUpdate = true;
            });
        }
        const glowMat = new THREE.SpriteMaterial({ map: createSoftGlowTexture(), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
        const glowSprite = new THREE.Sprite(glowMat); glowSprite.scale.set(config.radius * 4.5, config.radius * 4.5, 1);
        visualMesh.add(glowSprite); sunVisualMesh = visualMesh;
    } else {
        const matParams = { color: config.color, roughness: 0.6, metalness: 0.1 };
        const mat = new THREE.MeshStandardMaterial(matParams);
        visualMesh = new THREE.Mesh(geo, mat);

        if (config.tex) {
            loadedMap = texLoader.load(config.tex, (texture) => {
                if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace; else texture.encoding = 3000;
                texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
                visualMesh.material.map = texture;
                visualMesh.material.color.setHex(0xffffff);
                visualMesh.material.needsUpdate = true;
                visualMesh.userData.originalMap = texture;
            });
        }

        if (config.nightTex) {
            texLoader.load(config.nightTex, (texture) => {
                if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace; else texture.encoding = 3000;
                visualMesh.material.emissiveMap = texture;
                visualMesh.material.needsUpdate = true;
            });
            baseEmissive = 0xffffff;
            baseEmissiveIntensity = 1.0;
            visualMesh.material.emissive.setHex(baseEmissive);
            visualMesh.material.emissiveIntensity = baseEmissiveIntensity;
        }

        visualMesh.castShadow = true; visualMesh.receiveShadow = true;

        if (config.atmTex) {
            const cloudMat = new THREE.MeshStandardMaterial({ transparent: true, opacity: config.name === "Venus" ? 0.8 : 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
            const clouds = new THREE.Mesh(new THREE.SphereGeometry(config.radius * 1.015, 64, 64), cloudMat);
            texLoader.load(config.atmTex, (tex) => { cloudMat.map = tex; cloudMat.needsUpdate = true; });
            visualMesh.add(clouds); group.userData.cloudsMesh = clouds;
        }

        const orbitGeo = new THREE.RingGeometry(config.dist - 0.05, config.dist + 0.05, 128);
        const orbitMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.08 });
        const orbitLine = new THREE.Mesh(orbitGeo, orbitMat); orbitLine.rotation.x = Math.PI / 2;
        scene.add(orbitLine);
    }

    visualMesh.userData = {
        radius: config.radius,
        targetScale: new THREE.Vector3(1, 1, 1), baseScale: 1.0, originalColor: config.color,
        currentColor: config.color, originalMap: loadedMap, originalEmissive: baseEmissive, originalEmissiveIntensity: baseEmissiveIntensity
    };
    group.userData.visualMesh = visualMesh; group.add(visualMesh);

    if (config.hasRing && config.ringTex) {
        const ringGeo = new THREE.RingGeometry(config.radius * 1.3, config.radius * 2.4, 128);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
        texLoader.load(config.ringTex, (tex) => { ringMat.map = tex; ringMat.needsUpdate = true; });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2 + 0.2; ring.castShadow = true; ring.receiveShadow = true;
        visualMesh.add(ring);
    }

    if (config.hasMoon) {
        const moonPivot = new THREE.Group();
        const moonMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const moon = new THREE.Mesh(new THREE.SphereGeometry(config.radius * 0.3, 32, 32), moonMat);
        texLoader.load("../textures/8k_moon.jpg", (tex) => {
            if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace; else tex.encoding = 3000;
            moonMat.map = tex; moonMat.needsUpdate = true;
        });
        moon.position.set(config.radius * 2.5, 0, 0); moon.castShadow = true; moon.receiveShadow = true;
        moonPivot.add(moon); visualMesh.add(moonPivot); group.userData.moonPivot = moonPivot;
    }

    scene.add(group); planetsList.push(group);
}

const planetsConfig = [
    {
        name: "Sun", radius: 6, color: null, dist: 0, speed: 0, axialSpeed: 0.005, isSun: true, tex: "../textures/8k_sun.jpg", shortDesc: "Mother star.",
        stats: { type: "Star", temp: "5,500 °C", grav: "274 m/s²" },
        fullDesc: "<p>The Sun is the mother star of our solar system, around which the eight principal planets orbit. It is a yellow dwarf consisting mainly of extremely hot plasma intertwined with magnetic fields.</p><h4>Internal Dynamics</h4><ul><li><b>Nuclear Fusion:</b> In the core, at about 15 million degrees, hydrogen is fused into helium, releasing enormous amounts of energy.</li><li><b>Photosphere:</b> It is the visible surface that radiates light towards Earth.</li><li><b>Corona:</b> The outer atmosphere, visible during eclipses, incredibly hotter than the surface.</li></ul><br><h4>Space Curiosities</h4><p>Despite being a medium-sized star, the Sun alone accounts for 99.86% of all the mass in the solar system. The energy it emits takes about 8 minutes to reach Earth in the form of sunlight.</p>",
        radiusData: "696,340 km", mass: "1.989 × 10^30 kg", distData: "0 AU", orbit: "0", atm1: ["Hydrogen", 73], atm2: ["Helium", 25], escapeVel: "617.5 km/s", core: "Dense Plasma", massRel: 100
    },
    {
        name: "Mercury", radius: 0.6, color: 0x888888, tex: "../textures/8k_mercury.jpg", dist: 10, speed: 0.02, axialSpeed: 0.002, shortDesc: "The closest planet to the Sun.",
        stats: { type: "Rocky", temp: "167 °C", grav: "3.7 m/s²" },
        fullDesc: "<p>Mercury is the smallest planet and the closest to the Sun in the entire solar system. Because of this proximity, it is difficult to observe from Earth except at dawn or dusk.</p><h4>Physical Characteristics</h4><ul><li><b>Surface:</b> Very similar to that of our Moon, it is heavily cratered from impacts, indicating that the planet has been geologically inactive for billions of years.</li><li><b>Thermal Excursion:</b> Despite being very close to the Sun, lacking an atmosphere to retain heat, its temperature plummets to -170°C at night and rises to 430°C during the day.</li></ul><br><h4>Human Exploration</h4><p>Only two spacecraft have ever visited Mercury up close: <i>Mariner 10</i> in the 1970s and the <i>MESSENGER</i> probe between 2011 and 2015. Currently, the European mission <i>BepiColombo</i> is en route to the planet.</p>",
        radiusData: "2,439 km", mass: "3.30 × 10^23 kg", distData: "0.39 AU", orbit: "88 Days", atm1: ["Oxygen", 42], atm2: ["Sodium", 29], escapeVel: "4.25 km/s", core: "Solid Iron", massRel: 5
    },
    {
        name: "Venus", radius: 1.2, color: 0xffaa55, tex: "../textures/8k_venus_surface.jpg", atmTex: "../textures/4k_venus_atmosphere.jpg", dist: 14, speed: 0.015, axialSpeed: -0.001, shortDesc: "Earth's infernal twin.",
        stats: { type: "Rocky", temp: "464 °C", grav: "8.8 m/s²" },
        fullDesc: "<p>Often considered Earth's \"twin planet\" due to similar size and mass, Venus is an infernal world governed by the most powerful greenhouse effect in the solar system.</p><h4>An Extreme World</h4><ul><li><b>Crushing Pressure:</b> The atmospheric pressure on the surface is 92 times that of Earth, equivalent to being 900 meters deep in the ocean.</li><li><b>Acid Rain:</b> The thick atmospheric clouds are mainly composed of highly corrosive sulfuric acid.</li><li><b>Retrograde Rotation:</b> Venus rotates on its axis in the opposite direction to most other planets. The Sun rises in the west and sets in the east.</li></ul><br><h4>Geological Mysteries</h4><p>Venus's surface, scanned by the Magellan probe using radar, reveals thousands of enormous shield volcanoes. Scientists suspect the planet is still geologically and volcanically active today.</p>",
        radiusData: "6,051 km", mass: "4.86 × 10^24 kg", distData: "0.72 AU", orbit: "224 Days", atm1: ["Carbon Dioxide", 96], atm2: ["Nitrogen", 3], escapeVel: "10.36 km/s", core: "Liquid Iron", massRel: 81
    },
    {
        name: "Earth", radius: 1.5, color: 0x2288ff, tex: "../textures/earth-blue-marble.jpg", nightTex: "../textures/8k_earth_nightmap.jpg", atmTex: "../textures/earth_clouds_1024.png", isEarth: true, dist: 20, speed: 0.01, axialSpeed: 0.02, hasMoon: true, shortDesc: "Our blue planet.",
        stats: { type: "Rocky", temp: "15 °C", grav: "9.8 m/s²" },
        fullDesc: "<p>Earth is the third planet from the Sun and is, to date, the only known celestial body to harbor life in the observable universe.</p><h4>Perfect Ecosystem</h4><ul><li><b>Liquid Water:</b> Over 71% of the surface is covered by saltwater oceans, fundamental for the origin of biology.</li><li><b>Magnetic Shield:</b> The molten iron core generates a magnetosphere that protects the atmosphere and life from lethal solar winds.</li><li><b>Plate Tectonics:</b> The continuous movement of the Earth's crust shapes the surface, creating mountains and oceanic trenches.</li></ul><br><h4>Human Footprint</h4><p>If you observe the shadow side of Earth, the planet glows with lights emitted by urban centers and global megalopolises, a visible testament from space to human presence and technological activity.</p>",
        radiusData: "6,371 km", mass: "5.97 × 10^24 kg", distData: "1.00 AU", orbit: "365 Days", atm1: ["Nitrogen", 78], atm2: ["Oxygen", 21], escapeVel: "11.19 km/s", core: "Iron and Nickel", massRel: 100
    },
    {
        name: "Mars", radius: 1.0, color: 0xff4422, tex: "../textures/8k_mars.jpg", dist: 26, speed: 0.008, axialSpeed: 0.019, shortDesc: "The famous Red Planet.",
        stats: { type: "Rocky", temp: "-65 °C", grav: "3.7 m/s²" },
        fullDesc: "<p>Mars, the fourth planet from the Sun, owes its iconic reddish color to the abundance of iron oxide (rust) on its dusty, desert-like surface.</p><h4>Extreme Geology</h4><ul><li><b>Olympus Mons:</b> It is the largest volcano in the entire solar system, over 21 kilometers high (almost three times Mount Everest).</li><li><b>Valles Marineris:</b> A massive canyon system stretching over 4,000 km, dwarfing Earth's Grand Canyon in size.</li><li><b>Ice Caps:</b> Like Earth, Mars has two polar ice caps made primarily of water ice and solid carbon dioxide.</li></ul><br><h4>The Future of Humanity</h4><p>Mars is the celestial body most studied by automated probes and rovers (such as <i>Curiosity</i> and <i>Perseverance</i>). Major space agencies and private companies are planning crewed missions to initiate interplanetary colonization within this century.</p>",
        radiusData: "3,389 km", mass: "6.39 × 10^23 kg", distData: "1.52 AU", orbit: "687 Days", atm1: ["Carbon Dioxide", 95], atm2: ["Nitrogen", 3], escapeVel: "5.03 km/s", core: "Iron and Sulfur", massRel: 11
    },
    {
        name: "Jupiter", radius: 3.5, color: 0xcc9966, tex: "../textures/8k_jupiter.jpg", dist: 36, speed: 0.004, axialSpeed: 0.05, shortDesc: "The king of the planets.",
        stats: { type: "Gaseous", temp: "-110 °C", grav: "24.7 m/s²" },
        fullDesc: "<p>Jupiter is a colossal gas giant, whose mass is more than two and a half times that of all the other planets in the solar system combined. It is composed almost entirely of hydrogen and helium.</p><h4>Eternal Storms</h4><ul><li><b>The Great Red Spot:</b> A gigantic anticyclonic storm that has been raging for over 300 years, so vast it could contain two entire Earths.</li><li><b>Metallic Hydrogen:</b> Deep in the planet's core, extreme pressures force gaseous hydrogen to behave like a conductive liquid metal.</li><li><b>Radiation Belt:</b> Jupiter possesses a terrifying magnetic field, capable of frying the electronic components of any probe that gets too close.</li></ul><br><h4>A Mini Solar System</h4><p>With over 90 discovered moons, including the Galilean satellites (Io, Europa, Ganymede, Callisto), Jupiter resembles a miniature planetary system. The moon Europa, in particular, hides an immense subsurface ocean that might harbor life.</p>",
        radiusData: "69,911 km", mass: "1.89 × 10^27 kg", distData: "5.20 AU", orbit: "4,333 Days", atm1: ["Hydrogen", 90], atm2: ["Helium", 10], escapeVel: "59.5 km/s", core: "Rock and Ice", massRel: 100
    },
    {
        name: "Saturn", radius: 2.8, color: 0xead6b8, tex: "../textures/8k_saturn.jpg", ringTex: "../textures/8k_saturn_ring_alpha.png", dist: 48, speed: 0.003, axialSpeed: 0.04, hasRing: true, shortDesc: "The Lord of the Rings.",
        stats: { type: "Gaseous", temp: "-140 °C", grav: "10.4 m/s²" },
        fullDesc: "<p>The sixth planet from the Sun and second largest after Jupiter, Saturn is known for its magnificent and complex system of planetary rings, making it one of the most recognizable and spectacular objects in the galaxy.</p><h4>The Majestic Rings</h4><ul><li><b>Composition:</b> The rings are not solid, but are formed by billions of small fragments of pure ice and space rock dust.</li><li><b>Ice and Dust:</b> Some blocks are as small as grains of sand, others as large as mountains. They are kept in order by the gravitational influence of \"shepherd moons\".</li><li><b>Hexagonal Storm:</b> A mysterious storm in the shape of a perfect hexagon rages at the planet's north pole, a unique fluid dynamic phenomenon.</li></ul><br><h4>Space Exploration</h4><p>The <i>Cassini-Huygens</i> probe studied the planet for over 13 years, revealing methane lakes on the moon Titan and ice geysers on the moon Enceladus, before plunging into Saturn's atmosphere in a grand finale.</p>",
        radiusData: "58,232 km", mass: "5.68 × 10^26 kg", distData: "9.58 AU", orbit: "10,759 Days", atm1: ["Hydrogen", 96], atm2: ["Helium", 3], escapeVel: "35.5 km/s", core: "Metal and Rock", massRel: 100
    },
    {
        name: "Uranus", radius: 2.0, color: 0x66ccff, tex: "../textures/2k_uranus.jpg", dist: 60, speed: 0.002, axialSpeed: -0.03, shortDesc: "The rolling ice giant.",
        stats: { type: "Icy", temp: "-195 °C", grav: "8.6 m/s²" },
        fullDesc: "<p>Uranus is the seventh planet and belongs to the \"Ice Giants\" category. Its pale cyan and blue color is due to the massive presence of methane gas in its freezing upper atmosphere.</p><h4>A Bizarre Tilt</h4><ul><li><b>Horizontal Rotation:</b> Uranus's axis of rotation is tilted by 98 degrees. This means the planet literally orbits \"lying on its side\", rolling like a ball along its orbit.</li><li><b>Extreme Winters:</b> Because of this axis/orbit tilt, each pole faces a period of uninterrupted total darkness lasting 42 Earth years.</li><li><b>Ring System:</b> Uranus also possesses faint and dark rings, extremely difficult to spot compared to Saturn's.</li></ul><br><h4>Limiting Missions</h4><p>So far, no probe has ever entered orbit around Uranus. The only spacecraft to have ever visited it was <i>Voyager 2</i> in 1986 during a rapid close flyby.</p>",
        radiusData: "25,362 km", mass: "8.68 × 10^25 kg", distData: "19.22 AU", orbit: "30,688 Days", atm1: ["Hydrogen", 83], atm2: ["Helium", 15], escapeVel: "21.3 km/s", core: "Rock and Ice", massRel: 100
    },
    {
        name: "Neptune", radius: 1.9, color: 0x3333ff, tex: "../textures/2k_neptune.jpg", dist: 70, speed: 0.001, axialSpeed: 0.035, shortDesc: "The extreme blue frontier.",
        stats: { type: "Icy", temp: "-200 °C", grav: "11.1 m/s²" },
        fullDesc: "<p>The eighth and farthest known official planet of the solar system, Neptune is a dark, freezing world battered by catastrophic storms. It has a deep blue color, much more pronounced than that of Uranus.</p><h4>Atmospheric Dynamics</h4><ul><li><b>Supersonic Winds:</b> Neptune hosts the most violent storms and winds ever recorded in the solar system, capable of reaching speeds of over 2,100 km/h.</li><li><b>The Great Dark Spot:</b> Similar to Jupiter's, this was a massive atmospheric depression observed in the 1980s, which later inexplicably vanished.</li><li><b>Diamond Rain:</b> Deep within the planet's liquid mantle, extreme pressure compacts carbon, forming microscopic diamonds that rain down toward the core.</li></ul><br><h4>The Icy Triton</h4><p>Its largest moon, Triton, orbits in the opposite direction to the planet's rotation, suggesting it is a dwarf planet that escaped the Kuiper belt and was captured by Neptune's immense gravity.</p>",
        radiusData: "24,622 km", mass: "1.02 × 10^26 kg", distData: "30.05 AU", orbit: "60,182 Days", atm1: ["Hydrogen", 80], atm2: ["Helium", 19], escapeVel: "23.5 km/s", core: "Iron and Silicates", massRel: 100
    }
];

planetsConfig.forEach(config => createPlanet(config));

const starGeo = new THREE.BufferGeometry();
const starPos = new Float32Array(5000 * 3);
for (let i = 0; i < 15000; i++) starPos[i] = (Math.random() - 0.5) * 400;
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, transparent: true, opacity: 0.8 })));

const raycaster = new THREE.Raycaster();

function openPlanetDetails(planetGroup) {
    isDetailMode = true; detailPlanetTarget = planetGroup;
    const data = planetGroup.userData;

    document.getElementById('detail_name').innerText = data.name;
    document.getElementById('detail_badge').innerText = data.stats.type;
    document.getElementById('detail_full_desc').innerHTML = data.fullDesc;
    document.getElementById('dt_radius').innerText = data.radiusData;
    document.getElementById('dt_mass').innerText = data.mass;
    document.getElementById('dt_dist').innerText = data.distData;
    document.getElementById('dt_orbit').innerText = data.orbit;
    document.getElementById('dt_escape').innerText = data.escapeVel;
    document.getElementById('dt_core').innerText = data.core;
    document.getElementById('atm_1_name').innerText = data.atm1[0];
    document.getElementById('atm_1_fill').style.width = data.atm1[1] + "%";
    document.getElementById('atm_2_name').innerText = data.atm2[0];
    document.getElementById('atm_2_fill').style.width = data.atm2[1] + "%";
    document.getElementById('mass_rel_fill').style.width = data.massRel + "%";

    if (infoPanel) infoPanel.className = "hidden";
    if (uiDashboard) uiDashboard.style.opacity = "0";

    if (detailPanel) {
        detailPanel.className = "visible";
        scrollVelocity = 0;
        const forceScrollTop = () => {
            detailPanel.scrollTop = 0;
            const detailContent = detailPanel.querySelector('.detail-content');
            if (detailContent) detailContent.scrollTop = 0;
        };
        requestAnimationFrame(() => {
            forceScrollTop();
            setTimeout(forceScrollTop, 10);
            setTimeout(forceScrollTop, 100);
            setTimeout(forceScrollTop, 400);
        });
    }

    AudioManager.playTone(600, 'sine', 0.4);
    AudioManager.speak("Accessing data for " + data.name);
}

const btnScan = document.getElementById('btn_scan_cams');
const btnStart = document.getElementById('btn_start');
const eyeSelect = document.getElementById('eye_cam_select');
const handSelect = document.getElementById('hand_cam_select');

btnScan.addEventListener('click', async () => {
    try {
        await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        eyeSelect.innerHTML = ''; handSelect.innerHTML = '';

        videoDevices.forEach((device, index) => {
            const label = device.label || `Camera ${index + 1}`;
            const opt1 = document.createElement('option'); opt1.value = device.deviceId; opt1.text = label; eyeSelect.appendChild(opt1);
            const opt2 = document.createElement('option'); opt2.value = device.deviceId; opt2.text = label; handSelect.appendChild(opt2);
        });
        btnScan.style.display = 'none'; btnStart.style.display = 'inline-block';
    } catch (e) { alert("Please allow camera and microphone access to select devices!"); }
});

function closeDetailMode() {
    isDetailMode = false; detailPlanetTarget = null;
    if (detailPanel) {
        detailPanel.className = "hidden";
        setTimeout(() => { detailPanel.scrollTop = 0; }, 600);
    }
    if (uiDashboard) uiDashboard.style.opacity = "1";
    if (grabbedPlanetGroup && infoPanel) infoPanel.className = "visible";
    AudioManager.playTone(400, 'square', 0.3);
}

btnStart.addEventListener('click', async () => {
    const startScreen = document.getElementById('start_screen');
    const calibScreen = document.getElementById('calibration_screen');
    startScreen.style.opacity = "0";
    setTimeout(() => { startScreen.style.display = "none"; calibScreen.style.display = "block"; }, 500);

    AudioManager.speak("Initializing ocular intelligence. Stare at the points to calibrate your gaze, or skip the procedure.");

    document.getElementById('status_voice').innerText = "Initializing...";
    document.getElementById('status_voice').className = "waiting";

    const eyeCamId = eyeSelect.value;
    const handCamId = handSelect.value;

    webgazer.clearData();
    webgazer.setCameraConstraints({ video: { deviceId: { exact: eyeCamId } } });
    webgazer.setGazeListener(function (data) {
        if (!data) return;
        if (!window.isWebGazerReady) {
            window.isWebGazerReady = true;
            if (uiGaze) { uiGaze.innerText = "Tracking Active"; uiGaze.className = "active"; }
        }
        const gazeCursor = document.getElementById('gaze_cursor');
        if (gazeCursor) gazeCursor.style.display = "block";
        const cX = parseFloat(gazeCursor.style.left) || data.x; const cY = parseFloat(gazeCursor.style.top) || data.y;
        const sX = cX + (data.x - cX) * 0.15; const sY = cY + (data.y - cY) * 0.15;
        if (gazeCursor) { gazeCursor.style.left = sX + 'px'; gazeCursor.style.top = sY + 'px'; }
        gazeCoordinates.x = (sX / window.innerWidth) * 2 - 1; gazeCoordinates.y = -(sY / window.innerHeight) * 2 + 1;
    }).begin();
    webgazer.showVideoPreview(true).showPredictionPoints(true);

    const pts = [
        [15, 15], [50, 15], [85, 15],
        [15, 50], [50, 50], [85, 50],
        [15, 85], [50, 85], [85, 85],
        [32.5, 32.5], [67.5, 32.5], [32.5, 67.5], [67.5, 67.5]
    ];
    let calibrationStarted = false;
    let pointsLeft = 13;
    const calibCounter = document.getElementById('calib_counter');
    const btnSkip = document.getElementById('btn_skip_calib');
    const btnStartPoints = document.getElementById('btn_start_calib_points');
    const calibInstructions = document.getElementById('calib_instructions');

    function concludeCalibrationFlow() {
        calibScreen.style.opacity = "0";
        setTimeout(() => {
            calibScreen.style.display = "none";
            document.getElementById('canvas3d').style.display = "block";
            document.getElementById('ui_dashboard').style.display = "block";
            document.getElementById('pip_container').style.display = "block";
            document.getElementById('info_panel').style.display = "block";
            camera3D.aspect = window.innerWidth / window.innerHeight;
            camera3D.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            isAppReady = true;
        }, 500);
        webgazer.showVideoPreview(false).showPredictionPoints(false);
        AudioManager.speak("Operating systems activated. 8K resolution online.");
    }

    btnSkip.onclick = concludeCalibrationFlow;

    const pointElements = [];
    pts.forEach(p => {
        const pt = document.createElement('div');
        pt.className = 'calibration-point';
        pt.style.left = p[0] + 'vw';
        pt.style.top = p[1] + 'vh';
        pt.style.display = 'none';
        let clicks = 0;
        pt.onclick = function () {
            if (!calibrationStarted) return;
            clicks++;
            AudioManager.playTone(300 + (clicks * 100), 'sine', 0.1);
            pt.style.transform = `translate(-50%, -50%) scale(${1 - (clicks * 0.15)})`;

            if (clicks === 2) pt.style.background = "#ffcc00";
            if (clicks === 4) pt.style.background = "#00ff88";
            if (clicks >= 5) {
                AudioManager.playTone(800, 'triangle', 0.2);
                pt.style.display = 'none';
                pointsLeft--;
                calibCounter.innerText = "Points remaining: " + pointsLeft;
                if (pointsLeft === 0) concludeCalibrationFlow();
            }
        };
        calibScreen.appendChild(pt);
        pointElements.push(pt);
    });

    if (btnStartPoints) {
        btnStartPoints.style.pointerEvents = "auto";
        btnStartPoints.addEventListener('click', () => {
            calibrationStarted = true;
            calibInstructions.style.display = 'none';
            calibCounter.style.display = 'block';
            pointElements.forEach(pt => pt.style.display = 'block');
        });
    }

    const videoElement = document.querySelector('.input_video');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: handCamId }, width: { ideal: 640 }, height: { ideal: 480 } } });
        videoElement.srcObject = stream; videoElement.play();
        async function sendFramesToMediaPipe() {
            if (!videoElement.paused && !videoElement.ended) await hands.send({ image: videoElement });
            requestAnimationFrame(sendFramesToMediaPipe);
        }
        videoElement.onloadeddata = () => sendFramesToMediaPipe();
    } catch (e) { console.error("Camera error:", e); }

    setTimeout(() => {
        document.getElementById('status_voice').innerText = "Listening...";
        document.getElementById('status_voice').className = "active";

        VoiceManager.init(
            (comandoFinale) => {
                if (uiTranscript) { uiTranscript.innerText = comandoFinale; uiTranscript.style.color = "#00ff88"; }

                if (comandoFinale.includes("new user") || comandoFinale.includes("next user")) {
                    let existingLogs = localStorage.getItem("cosmos_logs") || "";
                    localStorage.setItem("cosmos_logs", existingLogs + "\n--- NEW USER SESSION ---\n");
                    AudioManager.speak("Profile reset and ready.");
                    return;
                }

                if (comandoFinale.includes("start task")) {
                    currentTaskName = comandoFinale;
                    testActive = true;
                    missedPinches = 0;
                    voiceErrors = 0;
                    totalGrabs = 0;
                    testStartTime = performance.now();
                    AudioManager.speak("Task started.");
                    return;
                }

                if (comandoFinale.includes("finish task") || comandoFinale.includes("stop task")) {
                    if (testActive) {
                        const timeElapsed = ((performance.now() - testStartTime) / 1000).toFixed(2);
                        const resultString = `Task: ${currentTaskName} | Time: ${timeElapsed}s | Missed Pinches: ${missedPinches} | Voice Fails: ${voiceErrors} | Total Grabs: ${totalGrabs}\n`;

                        let existingLogs = localStorage.getItem("cosmos_logs") || "";
                        localStorage.setItem("cosmos_logs", existingLogs + resultString);

                        testActive = false;
                        AudioManager.speak(`Task finished in ${timeElapsed} seconds.`);
                        console.log(`[LOGGER] Salvato: ${resultString}`);
                    }
                    return;
                }

                if (comandoFinale.includes("export logs") || comandoFinale.includes("download data")) {
                    const logs = localStorage.getItem("cosmos_logs") || "No data recorded yet.";
                    const blob = new Blob([logs], { type: "text/plain" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = "cosmos_test_results.txt";
                    a.click();
                    AudioManager.speak("Logs exported.");
                    return;
                }

                if (comandoFinale.includes("clear logs") || comandoFinale.includes("delete data")) {
                    localStorage.removeItem("cosmos_logs");
                    AudioManager.speak("All system logs have been deleted.");
                    console.log("[LOGGER] Memoria svuotata con successo.");
                    return;
                }

                if (comandoFinale.includes("stop") || comandoFinale.includes("pause")) {
                    targetTimeScale = 0.0; AudioManager.playTone(300, 'sawtooth', 0.1);
                    if (uiTarget) { uiTarget.innerText = "TIME SUSPENDED ⏳"; uiTarget.className = "danger"; }
                    return;
                } else if (comandoFinale.includes("resume") || comandoFinale.includes("play") || comandoFinale.includes("start")) {
                    targetTimeScale = 1.0; AudioManager.playTone(600, 'sine', 0.1);
                    if (uiTarget) { uiTarget.innerText = "NORMAL SPEED ▶️"; uiTarget.className = "highlight"; }
                    return;
                } else if (comandoFinale.includes("accelerate") || comandoFinale.includes("fast") || comandoFinale.includes("faster")) {
                    targetTimeScale += 1.0; AudioManager.playTone(800, 'sine', 0.1);
                    if (uiTarget) { uiTarget.innerText = `SPEED: ${targetTimeScale.toFixed(1)}x 🚀`; uiTarget.className = "highlight"; }
                    return;
                } else if (comandoFinale.includes("slow down") || comandoFinale.includes("slow") || comandoFinale.includes("slower")) {
                    targetTimeScale -= 1.0; AudioManager.playTone(500, 'sine', 0.1);
                    if (uiTarget) { uiTarget.innerText = `SPEED: ${targetTimeScale.toFixed(1)}x 🐢`; uiTarget.className = "highlight"; }
                    return;
                }

                if (isDetailMode && (comandoFinale.includes("back") || comandoFinale.includes("exit") || comandoFinale.includes("close"))) {
                    closeDetailMode(); return;
                }

                if (!isDetailMode && isAppReady) {
                    let directVoicePlanet = null;
                    planetsList.forEach(p => {
                        const n = p.userData.name.toLowerCase();
                        if (comandoFinale === n || comandoFinale.includes("show " + n) || comandoFinale.includes("open " + n) || comandoFinale.includes("go to " + n)) {
                            directVoicePlanet = p;
                        }
                    });

                    if (directVoicePlanet) {
                        grabbedPlanetGroup = directVoicePlanet;
                        openPlanetDetails(directVoicePlanet);
                        return;
                    }
                }

                if (!grabbedPlanetGroup) return;

                if (!isDetailMode && (comandoFinale.includes("information") || comandoFinale.includes("details"))) {
                    openPlanetDetails(grabbedPlanetGroup);
                    return;
                }

                const vis = grabbedPlanetGroup.userData.visualMesh;
                const isSun = grabbedPlanetGroup.userData.isSun;

                if (!isDetailMode) {
                    if (comandoFinale.includes("enlarge") || comandoFinale.includes("bigger")) {
                        vis.userData.baseScale *= 1.5; AudioManager.playTone(600, 'sine', 0.2);
                    } else if (comandoFinale.includes("shrink") || comandoFinale.includes("smaller")) {
                        vis.userData.baseScale *= 0.6; AudioManager.playTone(300, 'sine', 0.2);
                    } else if (comandoFinale.includes("restore") || comandoFinale.includes("normal") || comandoFinale.includes("reset")) {
                        vis.userData.baseScale = 1.0;
                        if (!isSun) {
                            if (vis.userData.originalMap) {
                                vis.material.map = vis.userData.originalMap;
                                vis.material.color.setHex(0xffffff);
                            } else {
                                vis.material.color.setHex(vis.userData.originalColor);
                            }
                            vis.userData.currentColor = vis.userData.originalColor;
                            vis.material.needsUpdate = true;
                        }
                        AudioManager.playTone(400, 'square', 0.2);
                    } else if (!isSun) {
                        let changedColor = false;
                        if (comandoFinale.includes("red")) { changeColor(vis, 0xff0000); changedColor = true; }
                        else if (comandoFinale.includes("blue") || comandoFinale.includes("light blue")) { changeColor(vis, 0x0088ff); changedColor = true; }
                        else if (comandoFinale.includes("green")) { changeColor(vis, 0x00ff00); changedColor = true; }
                        else if (comandoFinale.includes("yellow")) { changeColor(vis, 0xffff00); changedColor = true; }
                        else if (comandoFinale.includes("purple")) { changeColor(vis, 0xaa00ff); changedColor = true; }
                        else if (comandoFinale.includes("gold") || comandoFinale.includes("golden")) { changeColor(vis, 0xffd700); changedColor = true; }
                        else if (comandoFinale.includes("white")) { changeColor(vis, 0xffffff); changedColor = true; }
                        else if (comandoFinale.includes("orange")) { changeColor(vis, 0xff8800); changedColor = true; }
                        else if (comandoFinale.includes("pink") || comandoFinale.includes("magenta")) { changeColor(vis, 0xff00ff); changedColor = true; }
                        else if (comandoFinale.includes("cyan") || comandoFinale.includes("turquoise")) { changeColor(vis, 0x00ffff); changedColor = true; }
                        else if (comandoFinale.includes("black") || comandoFinale.includes("dark")) { changeColor(vis, 0x222222); changedColor = true; }
                        else if (comandoFinale.includes("brown")) { changeColor(vis, 0x8b4513); changedColor = true; }
                        else if (comandoFinale.includes("gray") || comandoFinale.includes("grey")) { changeColor(vis, 0x888888); changedColor = true; }
                        else if (comandoFinale.includes("silver")) { changeColor(vis, 0xc0c0c0); changedColor = true; }

                        if (changedColor && vis.material.map) {
                            vis.material.map = null;
                            vis.material.needsUpdate = true;
                        }

                        if (testActive && !comandoFinale.includes("details") && !comandoFinale.includes("information")) {
                            voiceErrors++;
                            console.log("[LOGGER] Errore vocale conteggiato: " + comandoFinale);
                        }
                    }
                }
            },
            (comandoProvvisorio) => {
                if (uiTranscript) { uiTranscript.innerText = comandoProvvisorio + "..."; uiTranscript.style.color = "#ffcc00"; }
            }
        );
    }, 2500);
});

function changeColor(mesh, hexColor) {
    mesh.userData.currentColor = hexColor;
    mesh.material.color.setHex(hexColor);
    AudioManager.playTone(500, 'triangle', 0.2);
}

const canvasElement = document.querySelector('.output_canvas');
const canvasCtx = canvasElement.getContext('2d', { willReadFrequently: true });

function analyzeGestures(l) {
    const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
    isPinchingGlobally = dist(l[4], l[8]) < 0.05;

    const wrist = l[0];
    handHistory.push({ x: wrist.x, y: wrist.y });
    if (handHistory.length > 10) handHistory.shift();

    if (isDetailMode && handHistory.length === 10 && !isPinchingGlobally) {
        const start = handHistory[0];
        const end = handHistory[9];
        const dx = end.x - start.x;
        const dy = end.y - start.y;

        if (Math.abs(dx) > 0.08 && Math.abs(dx) > Math.abs(dy)) {
            closeDetailMode(); handHistory = [];
        }
        else if (Math.abs(dy) > 0.03 && Math.abs(dy) > Math.abs(dx)) {
            scrollVelocity -= dy * 300; handHistory = [];
        }
    }
}

function onResultsHands(results) {
    if (!window.isHandReady) { window.isHandReady = true; if (uiHand) { uiHand.innerText = "Tracking Active"; uiHand.className = "active"; } }
    canvasCtx.save(); canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const l = results.multiHandLandmarks[0];
        drawConnectors(canvasCtx, l, HAND_CONNECTIONS, { color: '#00FF88', lineWidth: 2 });
        drawLandmarks(canvasCtx, l, { color: '#FF3366', lineWidth: 1, radius: 2 });
        analyzeGestures(l);
    } else {
        isPinchingGlobally = false; handHistory = [];
    }
    canvasCtx.restore();
}

const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
hands.onResults(onResultsHands);

function animate3D() {
    requestAnimationFrame(animate3D);

    currentTimeScale += (targetTimeScale - currentTimeScale) * 0.1;

    if (isDetailMode && Math.abs(scrollVelocity) > 0.1) {
        detailPanel.scrollBy(0, scrollVelocity);
        scrollVelocity *= 0.9;
    }

    planetsList.forEach(p => {
        p.userData.theoreticalAngle += p.userData.speed * currentTimeScale;

        if (grabbedPlanetGroup === p || isDetailMode) {
        } else {
            let diff = p.userData.theoreticalAngle - p.userData.angle;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            p.userData.angle += diff * 0.08;
            p.position.x = Math.cos(p.userData.angle) * p.userData.dist;
            p.position.z = Math.sin(p.userData.angle) * p.userData.dist;
        }

        p.userData.visualMesh.rotation.y += p.userData.axialSpeed * currentTimeScale;
        if (p.userData.cloudsMesh) p.userData.cloudsMesh.rotation.y += (p.userData.axialSpeed * 1.2) * currentTimeScale;
        if (p.userData.moonPivot) p.userData.moonPivot.rotation.y += 0.03 * currentTimeScale;
    });

    if (isDetailMode && detailPlanetTarget) {
        const pPos = detailPlanetTarget.position;
        const r = detailPlanetTarget.userData.radius;
        const currentScale = detailPlanetTarget.userData.visualMesh.scale.x;
        const effectiveRadius = r * currentScale;

        const dist = effectiveRadius * 3.5 + 10;
        const shiftRight = dist * 0.45;

        let idealCamPos = new THREE.Vector3(pPos.x + shiftRight, pPos.y + dist * 0.2, pPos.z + dist);
        let lookOffset = new THREE.Vector3(pPos.x + shiftRight, pPos.y, pPos.z);

        let distanceToTravel = camera3D.position.distanceTo(idealCamPos);
        let arcHeight = Math.min(distanceToTravel * 0.4, 50);

        let targetCamPos = idealCamPos.clone();
        targetCamPos.y += arcHeight;

        camera3D.position.lerp(targetCamPos, 0.08);
        currentLookTarget.lerp(lookOffset, 0.08);
        camera3D.lookAt(currentLookTarget);

    } else {
        camera3D.position.lerp(defaultCameraPos, 0.05);
        currentLookTarget.lerp(defaultLookAt, 0.05);
        camera3D.lookAt(currentLookTarget);
    }

    if (!isDetailMode && isAppReady) {
        raycaster.setFromCamera(gazeCoordinates, camera3D);
        let closestPlanet = null; let minDistance = 8;
        planetsList.forEach(p => {
            const distanceToRay = raycaster.ray.distanceToPoint(p.position);
            if (distanceToRay < minDistance) { minDistance = distanceToRay; closestPlanet = p; }
        });
        hoveredGroup = closestPlanet;

        if (hoveredGroup && hoveredGroup !== prevHovered && !grabbedPlanetGroup) {
            AudioManager.playTone(800, 'sine', 0.05); prevHovered = hoveredGroup;
        } else if (!hoveredGroup) { prevHovered = null; }

        if (isPinchingGlobally) {
            if (!wasPinching) {
                wasPinching = true;

                const btn = document.getElementById('toggle_cmds');
                if (btn && btn.style.display !== 'none') {
                    const rect = btn.getBoundingClientRect();
                    const gazeX = (gazeCoordinates.x + 1) / 2 * window.innerWidth;
                    const gazeY = -(gazeCoordinates.y - 1) / 2 * window.innerHeight;

                    if (gazeX >= rect.left && gazeX <= rect.right && gazeY >= rect.top && gazeY <= rect.bottom) {
                        btn.click();
                        AudioManager.playTone(400, 'square', 0.1);
                        return;
                    }
                }

                if (!grabbedPlanetGroup && hoveredGroup) {
                    grabbedPlanetGroup = hoveredGroup;
                    AudioManager.playTone(200, 'square', 0.1);

                    if (testActive) totalGrabs++;

                    if (document.getElementById('info_title')) document.getElementById('info_title').innerText = grabbedPlanetGroup.userData.name;
                    if (document.getElementById('info_desc')) document.getElementById('info_desc').innerText = grabbedPlanetGroup.userData.shortDesc;
                    if (document.getElementById('info_type')) document.getElementById('info_type').innerText = grabbedPlanetGroup.userData.stats.type;
                    if (document.getElementById('info_temp')) document.getElementById('info_temp').innerText = grabbedPlanetGroup.userData.stats.temp;
                    if (document.getElementById('info_grav')) document.getElementById('info_grav').innerText = grabbedPlanetGroup.userData.stats.grav;
                    if (infoPanel) infoPanel.className = "visible";
                }
                else if (!grabbedPlanetGroup && !hoveredGroup && !isDetailMode) {
                    if (testActive) missedPinches++;
                }
            }
        } else {
            wasPinching = false;
            if (grabbedPlanetGroup) { AudioManager.playTone(150, 'sawtooth', 0.1); if (infoPanel) infoPanel.className = "hidden"; }
            grabbedPlanetGroup = null;
        }
    } else { hoveredGroup = null; }

    planetsList.forEach(p => {
        const vis = p.userData.visualMesh;
        const isSun = p.userData.isSun;
        const currentBaseScale = vis.userData.baseScale;

        if (isDetailMode && p === detailPlanetTarget) {
            vis.userData.targetScale.set(currentBaseScale * 3, currentBaseScale * 3, currentBaseScale * 3);
            if (!isSun) {
                vis.material.emissive?.setHex(vis.userData.originalEmissive);
                vis.material.emissiveIntensity = vis.userData.originalEmissiveIntensity;
            }
        } else if (p === grabbedPlanetGroup && !isDetailMode) {
            vis.userData.targetScale.set(currentBaseScale * 1.6, currentBaseScale * 1.6, currentBaseScale * 1.6);
            if (!isSun) { vis.material.emissive?.setHex(0xff3366); vis.material.emissiveIntensity = 0.8; }
            if (uiTarget) { uiTarget.innerText = p.userData.name; uiTarget.className = "danger"; }
        } else if (p === hoveredGroup && !grabbedPlanetGroup && !isDetailMode) {
            vis.userData.targetScale.set(currentBaseScale * 1.2, currentBaseScale * 1.2, currentBaseScale * 1.2);
            if (!isSun) { vis.material.emissive?.setHex(vis.userData.currentColor); vis.material.emissiveIntensity = 0.5; }
            if (uiTarget) { uiTarget.innerText = "Aiming: " + p.userData.name; uiTarget.className = "highlight"; }
        } else {
            vis.userData.targetScale.set(currentBaseScale, currentBaseScale, currentBaseScale);
            if (!isSun) {
                vis.material.emissive?.setHex(vis.userData.originalEmissive);
                vis.material.emissiveIntensity = vis.userData.originalEmissiveIntensity;
            }
        }

        vis.scale.lerp(vis.userData.targetScale, 0.1);
    });

    if (!grabbedPlanetGroup && !hoveredGroup && !isDetailMode) {
        if (uiTarget) { uiTarget.innerText = `Speed: ${targetTimeScale.toFixed(1)}x`; uiTarget.className = "waiting"; }
    }

    renderer.render(scene, camera3D);
}
animate3D();

window.addEventListener('resize', () => {
    camera3D.aspect = window.innerWidth / window.innerHeight;
    camera3D.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});