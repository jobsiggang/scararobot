"use client";

import React, { useEffect, useState, useRef } from "react";
import { Grid, Paper, Slider, Typography, Box, Button, styled } from "@mui/material";
import mqtt from "mqtt";

// Utility Functions
function deg2rad(d) { return (d * Math.PI) / 180; }
function rad2deg(r) { return (r * 180) / Math.PI; }
function mapRange(v, inMin, inMax, outMin, outMax) {
  return outMin + ((v - inMin) * (outMax - outMin)) / (inMax - inMin);
}

// 🎄 크리스마스 테마 컴포넌트
const XmasBox = styled(Box)({
  minHeight: '100%',
  backgroundColor: '#0a2f0a', 
  color: '#ffffff',
  padding: '8px',
});

const XmasPaper = styled(Paper)({
  backgroundColor: '#1a1a1a',
  color: '#ffffff',
  border: '2px solid #ff0000', 
  boxShadow: '0 0 10px #00ff00', 
  height: '100%',
});

const XmasSlider = styled(Slider)({
  color: '#ff0000', 
  '& .MuiSlider-thumb': {
    backgroundColor: '#00ff00', 
    border: '2px solid #ffffff',
  },
});

export default function Home() {
  const [client, setClient] = useState(null);
  const mqttServer = "wss://broker.emqx.io:8084/mqtt";
  const topicStatus = "globalsmallestfarm/scara/status/#"; 
  const [xSpeed, setXSpeed] = useState(0); 
  const [ySpeed, setYSpeed] = useState(0); 
  const [zSpeed, setZSpeed] = useState(0); 
  const [gripper, setGripper] = useState(0); 
  const canvasRef = useRef(null);
  const L1 = 80; 
  const L2 = 100; 
  const shoulderBase = deg2rad(270); 
  const armInnerAngle = deg2rad(-130);
  const X_EXTRA_MIN = 0, X_EXTRA_MAX = 300;  
  const Y_EXTRA_MIN = 0, Y_EXTRA_MAX = 90;  
  const [canvasHeight, setCanvasHeight] = useState('400px');  

  // --- MQTT 연결 ---
  useEffect(() => {
    setCanvasHeight(`calc(60vh)`);
    const c = mqtt.connect(mqttServer);
    setClient(c);
    c.on("connect", () => {
      c.subscribe(topicStatus);
      c.publish("globalsmallestfarm/scara/command/xSpeed", "0");
      c.publish("globalsmallestfarm/scara/command/ySpeed", "0");
      c.publish("globalsmallestfarm/scara/command/zSpeed", "0");
      c.publish("globalsmallestfarm/scara/command/gripper", "0");
    });
    return () => c.end();
  }, []);

  // --- MQTT 발행 ---
  const publish = (suffix, value) => {
    if (client && client.connected) client.publish(`globalsmallestfarm/scara/command/${suffix}`, value.toString());
  };

  const handleChange = (setter, suffix) => (e, v) => {
    setter(v);
    // Z축 증폭 (웹앱 -> 아두이노)
    if (suffix === "zSpeed") {
      const amplified = Math.min(v * 2, 1023);
      publish(suffix, amplified);
    } else {
      publish(suffix, v);
    }
  };

  const handleHome = () => {
    setXSpeed(0); setYSpeed(0); setZSpeed(0); setGripper(0);
    publish("xSpeed", 0); publish("ySpeed", 0); publish("zSpeed", 0); publish("gripper", 0);
  };

  // --- 캔버스 시뮬레이션 ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width = canvas.clientWidth;
    const H = canvas.height = canvas.clientHeight;
    let raf;

    const draw = () => {
      ctx.clearRect(0,0,W,H);
      const centerX = W / 2;
      const baseY = H - 50; 

      // Z축 시뮬레이션 크게
      const zVisualHeight = mapRange(zSpeed, 0, 512, 0, H * 0.9);
      const zHeight = Math.min(zVisualHeight, H * 0.9);

      const armExtraDeg = mapRange(xSpeed, 0, 512, X_EXTRA_MIN, X_EXTRA_MAX);
      const shoulderExtraDeg = mapRange(ySpeed, 0, 512, Y_EXTRA_MIN, Y_EXTRA_MAX);
      const shoulderAngle = shoulderBase + deg2rad(shoulderExtraDeg);
      const armAngle = shoulderAngle + armInnerAngle + deg2rad(armExtraDeg);

      const shoulderX = centerX;
      const shoulderY = baseY - zHeight;
      const elbowX = shoulderX + L2 * Math.cos(shoulderAngle);
      const elbowY = shoulderY + L2 * Math.sin(shoulderAngle); 
      const handX = elbowX + L1 * Math.cos(armAngle);
      const handY = elbowY + L1 * Math.sin(armAngle); 

      // Base
      ctx.fillStyle = "#00ff00"; 
      ctx.fillRect(centerX - 20, baseY, 40, 20);

      // Z-axis (보라색)
      ctx.fillStyle = "#800080"; 
      ctx.fillRect(centerX - 10, baseY - zHeight, 20, zHeight);

      // Shoulder -> Elbow
      ctx.strokeStyle = "#ff0000"; 
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(shoulderX, shoulderY);
      ctx.lineTo(elbowX, elbowY);
      ctx.stroke();

      // Elbow -> Hand
      ctx.strokeStyle = "#00ff00"; 
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(elbowX, elbowY);
      ctx.lineTo(handX, handY);
      ctx.stroke();

      // 그리퍼 (원형)
      const gRadius = 5 + gripper * 0.2;
      ctx.fillStyle = "#ff0000"; 
      ctx.beginPath();
      ctx.arc(handX, handY, gRadius, 0, Math.PI*2);
      ctx.fill();

      // 정보 텍스트
      ctx.fillStyle = "#ffffff"; 
      ctx.font = "12px sans-serif";
      ctx.fillText(`Y-Shoulder deg: ${rad2deg(shoulderAngle).toFixed(1)} (0~${Y_EXTRA_MAX}°)`, 10, 20); 
      ctx.fillText(`X-Arm deg: ${rad2deg(armAngle).toFixed(1)} (0~${X_EXTRA_MAX}°)`, 10, 40);
      ctx.fillText(`Z-Height: ${zSpeed} / 512`, 10, 60);

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [xSpeed, ySpeed, zSpeed, gripper]);

  return (
    <XmasBox>
      <Typography variant="h4" gutterBottom sx={{ color: '#ff0000', mb: 1 }}>
        SCARA Control Panel 🎄
      </Typography>
      <Grid container spacing={1} direction="row">
        
        {/* 좌측 슬라이더 */}
        <Grid item xs={12} md={4}>
          <XmasPaper sx={{ p:2 }}>
            <Typography variant="h6" gutterBottom sx={{ color: '#00ff00', mb:1 }}>
              Axis Control
            </Typography>

            <Box sx={{ mb: 1 }}>
              <Typography variant="body2">Y Axis (Shoulder)</Typography>
              <XmasSlider value={ySpeed} onChange={handleChange(setYSpeed, "ySpeed")}
                min={0} max={512} valueLabelDisplay="auto" />
            </Box>

            <Box sx={{ mb: 1 }}>
              <Typography variant="body2">X Axis (Arm)</Typography>
              <XmasSlider value={xSpeed} onChange={handleChange(setXSpeed, "xSpeed")}
                min={0} max={512} valueLabelDisplay="auto" />
            </Box>

            <Box sx={{ mb: 1 }}>
              <Typography variant="body2">Z Axis (Height)</Typography>
              <XmasSlider value={zSpeed} onChange={handleChange(setZSpeed, "zSpeed")}
                min={0} max={512} valueLabelDisplay="auto" />
            </Box>

            <Box sx={{ mb: 1 }}>
              <Typography variant="body2">Gripper</Typography>
              <XmasSlider value={gripper} onChange={handleChange(setGripper, "gripper")}
                min={0} max={40} valueLabelDisplay="auto" />
            </Box>

            <Button variant="contained"
              sx={{ width:"100%", backgroundColor: '#ff0000', color:'#ffffff', '&:hover': { backgroundColor:'#00ff00', color:'#000' } }}
              onClick={handleHome}>
              Home (Stop & Reset) 🎁
            </Button>
          </XmasPaper>
        </Grid>

        {/* 우측 캔버스 */}
        <Grid item xs={12} md={8}>
          <XmasPaper sx={{ p:1 }}>
            <div style={{ width:"100%", minHeight: 300, height: canvasHeight }}>
              <canvas ref={canvasRef}
                style={{
                  width:"100%", 
                  height:"100%",
                  display:"block",
                  background:"#003300",
                  border:'2px solid #ff0000',
                }} />
            </div>
          </XmasPaper>
        </Grid>
      </Grid>
    </XmasBox>
  );
}
