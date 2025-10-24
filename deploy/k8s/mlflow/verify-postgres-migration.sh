#!/bin/bash

set -e

NAMESPACE="mlflow"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

ERRORS=0

print_header "MLflow PostgreSQL Migration Verification"

# Check 1: PostgreSQL Pod Status
print_header "1. Checking PostgreSQL Pod Status"
if kubectl get pods -n $NAMESPACE -l app=postgres &> /dev/null; then
    POSTGRES_POD=$(kubectl get pods -n $NAMESPACE -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [ -n "$POSTGRES_POD" ]; then
        POSTGRES_STATUS=$(kubectl get pod $POSTGRES_POD -n $NAMESPACE -o jsonpath='{.status.phase}')
        if [ "$POSTGRES_STATUS" == "Running" ]; then
            print_success "PostgreSQL pod is running: $POSTGRES_POD"

            # Check if ready
            READY=$(kubectl get pod $POSTGRES_POD -n $NAMESPACE -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
            if [ "$READY" == "True" ]; then
                print_success "PostgreSQL pod is ready"
            else
                print_error "PostgreSQL pod is NOT ready"
                ((ERRORS++))
            fi
        else
            print_error "PostgreSQL pod status: $POSTGRES_STATUS"
            ((ERRORS++))
        fi
    else
        print_error "PostgreSQL pod not found"
        ((ERRORS++))
    fi
else
    print_error "PostgreSQL deployment not found"
    ((ERRORS++))
fi

# Check 2: PostgreSQL Service
print_header "2. Checking PostgreSQL Service"
if kubectl get svc postgres -n $NAMESPACE &> /dev/null; then
    print_success "PostgreSQL service exists"
    POSTGRES_IP=$(kubectl get svc postgres -n $NAMESPACE -o jsonpath='{.spec.clusterIP}')
    print_info "PostgreSQL service IP: $POSTGRES_IP"
else
    print_error "PostgreSQL service not found"
    ((ERRORS++))
fi

# Check 3: MLflow Pods Status
print_header "3. Checking MLflow Pods Status"
MLFLOW_PODS=$(kubectl get pods -n $NAMESPACE -l app=mlflow -o jsonpath='{.items[*].metadata.name}')
if [ -n "$MLFLOW_PODS" ]; then
    print_success "Found MLflow pods: $MLFLOW_PODS"

    for POD in $MLFLOW_PODS; do
        STATUS=$(kubectl get pod $POD -n $NAMESPACE -o jsonpath='{.status.phase}')
        READY=$(kubectl get pod $POD -n $NAMESPACE -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')

        if [ "$STATUS" == "Running" ] && [ "$READY" == "True" ]; then
            print_success "Pod $POD is running and ready"
        else
            print_error "Pod $POD - Status: $STATUS, Ready: $READY"
            ((ERRORS++))
        fi
    done
else
    print_error "No MLflow pods found"
    ((ERRORS++))
fi

# Check 4: MLflow Configuration (PostgreSQL connection string)
print_header "4. Checking MLflow Configuration"
MLFLOW_POD=$(kubectl get pods -n $NAMESPACE -l app=mlflow -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [ -n "$MLFLOW_POD" ]; then
    print_info "Checking MLflow configuration in pod: $MLFLOW_POD"

    # Check if using PostgreSQL in the command
    CMD=$(kubectl get pod $MLFLOW_POD -n $NAMESPACE -o jsonpath='{.spec.containers[0].args}' | grep -o "postgresql://")
    if [ -n "$CMD" ]; then
        print_success "MLflow is configured to use PostgreSQL backend"
    else
        print_error "MLflow does NOT appear to be using PostgreSQL"
        print_error "Still using SQLite?"
        ((ERRORS++))
    fi

    # Show the full backend URI (masked password)
    BACKEND_URI=$(kubectl get pod $MLFLOW_POD -n $NAMESPACE -o jsonpath='{.spec.containers[0].args[2]}' 2>/dev/null | grep -o "backend-store-uri [^ ]*" 2>/dev/null | sed 's/:.*@/:***@/' 2>/dev/null || echo "backend-store-uri (unable to extract)")
    print_info "Backend URI: $BACKEND_URI"
fi

# Check 5: PostgreSQL Database Connection
print_header "5. Testing PostgreSQL Database Connection"
if [ -n "$POSTGRES_POD" ]; then
    print_info "Testing database connection from PostgreSQL pod..."

    if timeout 10 kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U mlflow -d mlflow -c "\dt" &> /dev/null; then
        print_success "Can connect to PostgreSQL database"

        # Check if MLflow tables exist
        TABLES=$(timeout 10 kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U mlflow -d mlflow -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ' || echo "0")

        if [ "$TABLES" -gt 0 ] 2>/dev/null; then
            print_success "MLflow database has $TABLES tables (schema initialized)"

            # List some key tables
            print_info "Key MLflow tables:"
            timeout 10 kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U mlflow -d mlflow -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('experiments', 'runs', 'metrics', 'params', 'tags') ORDER BY table_name;" 2>/dev/null || true

        else
            print_error "No tables found in database - schema may not be initialized"
            print_info "Run: kubectl exec -n $NAMESPACE $MLFLOW_POD -- mlflow db upgrade postgresql://USER:PASS@postgres:5432/mlflow"
            ((ERRORS++))
        fi
    else
        print_error "Cannot connect to PostgreSQL database (timeout or connection failed)"
        ((ERRORS++))
    fi
fi

# Check 6: MLflow Logs for PostgreSQL Connection
print_header "6. Checking MLflow Logs for Database Connection"
if [ -n "$MLFLOW_POD" ]; then
    print_info "Checking recent MLflow logs..."

    # Check for PostgreSQL connection in logs
    LOGS=$(kubectl logs -n $NAMESPACE $MLFLOW_POD --tail=100 2>/dev/null)

    if echo "$LOGS" | grep -i "postgresql" &> /dev/null; then
        print_success "MLflow logs mention PostgreSQL"
    fi

    if echo "$LOGS" | grep -i "error\|exception\|failed" &> /dev/null; then
        print_error "Found errors in MLflow logs:"
        echo "$LOGS" | grep -i "error\|exception\|failed" | tail -5
        ((ERRORS++))
    else
        print_success "No errors found in recent MLflow logs"
    fi

    # Show last few log lines
    print_info "Recent log entries:"
    echo "$LOGS" | tail -5
fi

# Check 7: Test Data Persistence
print_header "7. Checking Data Persistence in PostgreSQL"
if [ -n "$POSTGRES_POD" ]; then
    # Check if there are any experiments
    EXP_COUNT=$(timeout 10 kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U mlflow -d mlflow -t -c "SELECT COUNT(*) FROM experiments;" 2>/dev/null | tr -d ' ' || echo "0")
    RUN_COUNT=$(timeout 10 kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U mlflow -d mlflow -t -c "SELECT COUNT(*) FROM runs;" 2>/dev/null | tr -d ' ' || echo "0")

    print_info "Experiments in database: $EXP_COUNT"
    print_info "Runs in database: $RUN_COUNT"

    if [ "$EXP_COUNT" -gt 0 ] 2>/dev/null || [ "$RUN_COUNT" -gt 0 ] 2>/dev/null; then
        print_success "Database contains MLflow data"
    else
        print_info "Database is empty (no experiments or runs yet)"
        print_info "This is normal for a fresh migration - create a test experiment to verify"
    fi
fi

# Check 8: Resource Usage
print_header "8. Checking Resource Usage"
echo ""
echo "PostgreSQL Resources:"
kubectl top pod -n $NAMESPACE -l app=postgres 2>/dev/null || print_info "Metrics not available (metrics-server may not be installed)"
echo ""
echo "MLflow Resources:"
kubectl top pod -n $NAMESPACE -l app=mlflow 2>/dev/null || print_info "Metrics not available (metrics-server may not be installed)"

# Check 9: Network Connectivity
print_header "9. Testing Network Connectivity (MLflow -> PostgreSQL)"
if [ -n "$MLFLOW_POD" ]; then
    print_info "Testing connectivity from MLflow to PostgreSQL service..."

    if timeout 10 kubectl exec -n $NAMESPACE $MLFLOW_POD -- sh -c "nc -zv postgres 5432" &> /dev/null; then
        print_success "MLflow can reach PostgreSQL service"
    else
        # Try with alternative method
        if timeout 10 kubectl exec -n $NAMESPACE $MLFLOW_POD -- sh -c "timeout 5 bash -c '</dev/tcp/postgres/5432'" &> /dev/null; then
            print_success "MLflow can reach PostgreSQL service"
        else
            print_error "MLflow CANNOT reach PostgreSQL service"
            ((ERRORS++))
        fi
    fi
fi

# Check 10: Verify NOT using SQLite
print_header "10. Verifying SQLite is NOT in Use"
if [ -n "$MLFLOW_POD" ]; then
    # Check if sqlite file exists and is being used
    SQLITE_CHECK=$(timeout 10 kubectl exec -n $NAMESPACE $MLFLOW_POD -- sh -c "ls -la /mlflow/mlflow.db 2>/dev/null" || echo "not_found")

    if [[ "$SQLITE_CHECK" == *"not_found"* ]] || [[ "$SQLITE_CHECK" == *"cannot access"* ]]; then
        print_success "No SQLite database file found - using PostgreSQL ✓"
    else
        print_info "SQLite file still exists (but may not be in use):"
        echo "$SQLITE_CHECK"
        print_info "Check the backend-store-uri to confirm PostgreSQL is active"
    fi
fi

# Summary
print_header "Verification Summary"
echo ""
if [ $ERRORS -eq 0 ]; then
    print_success "All checks passed! ✓"
    print_success "MLflow is successfully using PostgreSQL backend"
    echo ""
    print_info "Your migration is complete!"
else
    print_error "Found $ERRORS issue(s) during verification"
    echo ""
    print_info "Please review the errors above and check:"
    echo "  - kubectl logs -n $NAMESPACE -l app=postgres"
    echo "  - kubectl logs -n $NAMESPACE -l app=mlflow"
    echo "  - kubectl describe pod -n $NAMESPACE -l app=mlflow"
    exit 1
fi

echo ""
print_info "To access MLflow UI:"
echo "  kubectl port-forward -n $NAMESPACE svc/mlflow 5000:80"
echo "  Then visit: http://localhost:5000"
echo ""
