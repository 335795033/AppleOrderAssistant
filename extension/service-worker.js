const Match_URL = ['apple.com.cn']

const mainPage = './dist/main.html'
const optionsPage = './dist/options.html'

const defaultVoiceInfo = {
    text: `抢到了`,
    times: 1,
}

chrome.action.onClicked.addListener(async tab => {
    console.log(`chrome action onClicked`)
    if (!tab.url) return
    const url = new URL(tab.url)
    const tabId = tab.id
    const isInMatchUrl = Match_URL.some(function (matchurl) {
        return url.origin.includes(matchurl)
    })

    if (isInMatchUrl) {
        // inject script in page first
        chrome.scripting.executeScript(
            {
                target: { tabId },
                world: 'MAIN',
                files: ['./inject-script.js'],
            },
            () => {
                const command = 'iphone_order'
                // after inject function in page window, then call it in page window
                chrome.scripting.executeScript({
                    target: { tabId },
                    world: 'MAIN',
                    args: [{ command, tabUrl: url.href }],
                    func: (...args) => {
                        // injectScript(...args)
                    },
                })
            }
        )
    }
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const {
        data,  extensionId, voiceInfo
    } = message || {}
    const { text, times, lang, voiceName} = voiceInfo || {}
    if((data == 'bellring') && extensionId &&  text && times){
        let voiceOption = {}
        if(lang && voiceName){
            voiceOption = {
                lang, voiceName
            }
        }
        // 播放N次：enqueue 合并到 options 中，tts.speak 第三参数应为回调函数而非对象
        for(let s=0; s<times; s++){
            chrome.tts.speak(text, Object.assign({}, voiceOption, {enqueue: s > 0}))
        }
    }
});