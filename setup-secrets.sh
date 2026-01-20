#!/bin/bash

# 全局变量
WRANGLER_CMD=""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的信息
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 检查 wrangler 是否已安装（优先使用本地 node_modules 中的）
check_wrangler() {
    # 优先检查本地 node_modules 中的 wrangler
    if [ -f "./node_modules/.bin/wrangler" ]; then
        WRANGLER_CMD="./node_modules/.bin/wrangler"
        print_success "找到本地 wrangler (./node_modules/.bin/wrangler)"
        return
    fi
    
    # 检查全局 wrangler
    if command -v wrangler &> /dev/null; then
        WRANGLER_CMD="wrangler"
        print_success "找到全局 wrangler"
        return
    fi
    
    # 都没找到
    print_error "wrangler 未安装或不在 PATH 中"
    echo "请先运行：pnpm install（安装本地） 或 npm install -g wrangler（安装全局）"
    exit 1
}

# 主菜单
main() {
    clear
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}        📅 Weather to Calendar - Wrangler Secrets 配置${NC}${BLUE}     ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    check_wrangler
    echo ""
    
    print_info "此脚本将引导你配置 Wrangler Secrets（敏感信息）"
    echo ""
    
    # 显示需要配置的 secrets
    echo -e "${YELLOW}需要配置的 Secrets：${NC}"
    echo "  1️⃣  QWEATHER_KEY_ID        - 和风天气凭据 ID"
    echo "  2️⃣  QWEATHER_PROJECT_ID    - 和风天气项目 ID"
    echo "  3️⃣  QWEATHER_PRIVATE_KEY   - Ed25519 私钥"
    echo ""
    
    read -p "按 Enter 继续..." dummy
    
    # 获取 QWEATHER_KEY_ID
    configure_key_id
    
    # 获取 QWEATHER_PROJECT_ID
    configure_project_id
    
    # 获取 QWEATHER_PRIVATE_KEY
    configure_private_key
    
    # 显示总结
    show_summary
}

configure_key_id() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}第 1 步：配置 QWEATHER_KEY_ID${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    print_info "这是你在和风天气控制台创建的凭据 ID"
    echo "  获取方式："
    echo "    1. 访问：https://console.qweather.com/project"
    echo "    2. 选择项目 → 添加凭据 → 选择 \"JSON Web Token\""
    echo "    3. 上传公钥后会获得凭据 ID（例如：CJ59BXXXX7）"
    echo ""
    
    while true; do
        read -p "请输入 QWEATHER_KEY_ID (例如: CJ59BXXXX7): " key_id
        
        if [ -z "$key_id" ]; then
            print_error "KEY_ID 不能为空"
            continue
        fi
        
        print_info "你输入的 KEY_ID: $key_id"
        read -p "确认无误？(y/n): " confirm
        
        if [[ $confirm == "y" || $confirm == "Y" ]]; then
            # 设置 secret
            echo ""
            print_info "正在保存到 Wrangler Secrets..."
            echo "$key_id" | $WRANGLER_CMD secret put QWEATHER_KEY_ID
            
            if [ $? -eq 0 ]; then
                print_success "QWEATHER_KEY_ID 已保存"
                SECRETS_SET[0]=1
            else
                print_error "保存失败，请检查 wrangler 配置"
                SECRETS_SET[0]=0
            fi
            break
        fi
    done
}

configure_project_id() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}第 2 步：配置 QWEATHER_PROJECT_ID${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    print_info "这是你在和风天气控制台的项目 ID"
    echo "  获取方式："
    echo "    1. 访问：https://console.qweather.com/project"
    echo "    2. 在项目管理页面查看项目 ID（例如：362XXXPXXU）"
    echo ""
    
    while true; do
        read -p "请输入 QWEATHER_PROJECT_ID (例如: 362XXXPXXU): " project_id
        
        if [ -z "$project_id" ]; then
            print_error "PROJECT_ID 不能为空"
            continue
        fi
        
        print_info "你输入的 PROJECT_ID: $project_id"
        read -p "确认无误？(y/n): " confirm
        
        if [[ $confirm == "y" || $confirm == "Y" ]]; then
            # 设置 secret
            echo ""
            print_info "正在保存到 Wrangler Secrets..."
            echo "$project_id" | $WRANGLER_CMD secret put QWEATHER_PROJECT_ID
            
            if [ $? -eq 0 ]; then
                print_success "QWEATHER_PROJECT_ID 已保存"
                SECRETS_SET[1]=1
            else
                print_error "保存失败，请检查 wrangler 配置"
                SECRETS_SET[1]=0
            fi
            break
        fi
    done
}

configure_private_key() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}第 3 步：配置 QWEATHER_PRIVATE_KEY${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    print_info "这是你的 Ed25519 私钥（PEM 格式）"
    echo "  获取方式："
    echo "    1. 如果尚未生成，运行："
    echo "       openssl genpkey -algorithm ED25519 -out ed25519-private.pem"
    echo "    2. 查看私钥内容："
    echo "       cat ed25519-private.pem"
    echo "    3. 复制完整的私钥内容（包括 BEGIN 和 END 行）"
    echo ""
    
    print_warning "请注意：私钥内容包含多行，将逐行读取直到输入空行"
    echo ""
    
    echo "请输入你的 Ed25519 私钥内容（完成输入后按 Enter 然后输入空行）："
    echo "开始行应该是: -----BEGIN PRIVATE KEY-----"
    echo ""
    
    # 读取多行输入
    private_key=""
    while IFS= read -r line; do
        if [ -z "$line" ]; then
            break
        fi
        if [ -z "$private_key" ]; then
            private_key="$line"
        else
            private_key="$private_key"$'\n'"$line"
        fi
    done
    
    if [ -z "$private_key" ]; then
        print_error "私钥不能为空"
        configure_private_key
        return
    fi
    
    echo ""
    print_info "你输入的私钥:"
    echo "$private_key" | head -c 50
    echo "..."
    echo ""
    
    read -p "确认无误？(y/n): " confirm
    
    if [[ $confirm == "y" || $confirm == "Y" ]]; then
        # 设置 secret
        echo ""
        print_info "正在保存到 Wrangler Secrets..."
        echo "$private_key" | $WRANGLER_CMD secret put QWEATHER_PRIVATE_KEY
        
        if [ $? -eq 0 ]; then
            print_success "QWEATHER_PRIVATE_KEY 已保存"
            SECRETS_SET[2]=1
        else
            print_error "保存失败，请检查 wrangler 配置"
            SECRETS_SET[2]=0
        fi
    else
        print_warning "已跳过 QWEATHER_PRIVATE_KEY"
        configure_private_key
    fi
}

show_summary() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}配置总结${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    all_success=true
    
    if [ ${SECRETS_SET[0]} -eq 1 ]; then
        print_success "QWEATHER_KEY_ID 已配置"
    else
        print_error "QWEATHER_KEY_ID 未配置"
        all_success=false
    fi
    
    if [ ${SECRETS_SET[1]} -eq 1 ]; then
        print_success "QWEATHER_PROJECT_ID 已配置"
    else
        print_error "QWEATHER_PROJECT_ID 未配置"
        all_success=false
    fi
    
    if [ ${SECRETS_SET[2]} -eq 1 ]; then
        print_success "QWEATHER_PRIVATE_KEY 已配置"
    else
        print_error "QWEATHER_PRIVATE_KEY 未配置"
        all_success=false
    fi
    
    echo ""
    
    if [ "$all_success" = true ]; then
        echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║${NC}                   ✨ 所有 Secrets 已成功配置！${NC}${GREEN}                ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        print_info "现在可以运行以下命令开始开发："
        echo "  ${BLUE}pnpm dev${NC}"
        echo ""
        print_info "部署到生产环境："
        echo "  ${BLUE}pnpm deploy${NC}"
    else
        echo -e "${YELLOW}⚠️  部分 Secrets 未成功配置，请重新运行此脚本${NC}"
    fi
    
    echo ""
}

# 初始化数组
SECRETS_SET=(0 0 0)

# 运行主程序
main
