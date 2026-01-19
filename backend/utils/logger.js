/**
 * 구조화된 로깅 유틸리티
 */

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
};

class Logger {
    constructor(context = 'APP') {
        this.context = context;
        this.level = LOG_LEVELS.INFO;
    }

    setLevel(level) {
        this.level = LOG_LEVELS[level] || LOG_LEVELS.INFO;
    }

    _log(level, message, meta = {}) {
        if (LOG_LEVELS[level] < this.level) return;

        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            context: this.context,
            message,
            ...meta,
        };

        const emoji = {
            DEBUG: '🔍',
            INFO: 'ℹ️',
            WARN: '⚠️',
            ERROR: '❌',
        }[level] || '';

        console.log(`${emoji} [${timestamp}] [${this.context}] ${message}`, meta);
    }

    debug(message, meta) {
        this._log('DEBUG', message, meta);
    }

    info(message, meta) {
        this._log('INFO', message, meta);
    }

    warn(message, meta) {
        this._log('WARN', message, meta);
    }

    error(message, meta) {
        this._log('ERROR', message, meta);
    }
}

// 기본 로거 인스턴스
export const logger = new Logger('APP');

// 컨텍스트별 로거 생성
export function createLogger(context) {
    return new Logger(context);
}
