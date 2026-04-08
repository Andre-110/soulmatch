class AppState {
    constructor() {
        this.currentStep = 0;
        this.container = document.getElementById('view-container');
        
        // Setup stars
        this.initStars();
        
        // Initial render
        this.renderStep();
    }

    initStars() {
        const starsContainer = document.getElementById('stars');
        for (let i = 0; i < 50; i++) {
            const star = document.createElement('div');
            star.classList.add('star');
            
            // Random positions
            const top = Math.random() * 100;
            const left = Math.random() * 100;
            
            // Random sizes
            const size = Math.random() * 3 + 1;
            
            // Random animations
            const duration = Math.random() * 4 + 2;
            const delay = Math.random() * 5;
            
            star.style.width = `${size}px`;
            star.style.height = `${size}px`;
            star.style.top = `${top}%`;
            star.style.left = `${left}%`;
            star.style.animationDuration = `${duration}s`;
            star.style.animationDelay = `${delay}s`;
            
            starsContainer.appendChild(star);
        }
    }

    getTemplateId() {
        if (this.currentStep === 0) return 'tpl-home';
        if (this.currentStep >= 1 && this.currentStep <= 5) return `tpl-step${this.currentStep}`;
        if (this.currentStep === 6) return 'tpl-loading';
        if (this.currentStep === 7) return 'tpl-result';
        return 'tpl-home';
    }

    async renderStep() {
        // Find existing content to fade out
        const oldContent = this.container.querySelector('.view-content');
        
        if (oldContent) {
            oldContent.classList.add('fade-out');
            await new Promise(r => setTimeout(r, 400));
            this.container.innerHTML = '';
        }

        const templateId = this.getTemplateId();
        const template = document.getElementById(templateId);
        
        if (template) {
            const clone = template.content.cloneNode(true);
            this.container.appendChild(clone);
            this.container.scrollTop = 0;
        }

        if (this.currentStep === 6) {
            this.simulateLoading();
        }
    }

    nextStep() {
        if (this.currentStep < 7) {
            this.currentStep++;
            this.renderStep();
        }
    }

    prevStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.renderStep();
        }
    }
    
    reset() {
        this.currentStep = 0;
        this.renderStep();
    }

    async simulateLoading() {
        const statuses = [
            "正在分析朋友圈情绪波段...",
            "提取网易云歌单 BPM 曲线...",
            "对比深夜随笔高频词...",
            "解码语音语调特征...",
            "融合多维数据，生成灵魂画像..."
        ];
        
        const loaderText = document.getElementById('loading-text');
        
        for (let i = 0; i < statuses.length; i++) {
            await new Promise(r => setTimeout(r, 1200));
            if (this.currentStep !== 6) return; // if user navigated away
            if (loaderText) {
                loaderText.style.opacity = 0;
                await new Promise(r => setTimeout(r, 300));
                loaderText.innerText = statuses[i];
                loaderText.style.opacity = 1;
            }
        }
        
        await new Promise(r => setTimeout(r, 1000));
        
        // Move to result
        if (this.currentStep === 6) {
            this.nextStep();
        }
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AppState();
});
